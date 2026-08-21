#include "cult/exchange/order_book.hpp"
#include <algorithm>
#include <stdexcept>

namespace cult::exchange {
LimitOrderBook::LimitOrderBook(InstrumentConfig config) : config_(config) {
  if (config_.tick_size <= 0 || config_.lot_size <= 0 || config_.minimum_order_size <= 0)
    throw std::invalid_argument("instrument increments must be positive");
}

void LimitOrderBook::emit(tape::MarketEventType type, tape::TimestampNs time, OrderId order_id, OrderId contra,
                          PriceTicks price, Quantity quantity, bool buy_aggressor, std::string reason) {
  if (time < last_event_time_ns_)
    throw std::invalid_argument("exchange event time cannot move backward");
  last_event_time_ns_ = time;
  events_.push_back({++sequence_, time, type, order_id, contra, config_.expression_id, price, quantity, buy_aggressor,
                     std::move(reason)});
}

bool LimitOrderBook::marketable(const OrderRequest &request) const {
  if (request.side == Side::buy)
    return !asks_.empty() && (request.type == OrderType::market || request.price_ticks >= asks_.begin()->first);
  return !bids_.empty() && (request.type == OrderType::market || request.price_ticks <= bids_.begin()->first);
}

Quantity LimitOrderBook::available(const OrderRequest &request) const {
  Quantity result = 0;
  if (request.side == Side::buy) {
    for (const auto &[price, orders] : asks_) {
      if (request.type == OrderType::limit && price > request.price_ticks)
        break;
      for (const auto &order : orders)
        if (order.agent_id != request.agent_id)
          result += order.remaining_quantity;
    }
  } else {
    for (const auto &[price, orders] : bids_) {
      if (request.type == OrderType::limit && price < request.price_ticks)
        break;
      for (const auto &order : orders)
        if (order.agent_id != request.agent_id)
          result += order.remaining_quantity;
    }
  }
  return result;
}

void LimitOrderBook::rest(const OrderRequest &request, Quantity remaining, tape::TimestampNs time) {
  RestingOrder order{request.order_id, request.agent_id, request.side, request.price_ticks,
                     request.quantity, remaining,        sequence_,    time};
  if (request.side == Side::buy) {
    auto &level = bids_[request.price_ticks];
    level.push_back(order);
    locators_.emplace(request.order_id, Locator{request.side, request.price_ticks, std::prev(level.end())});
  } else {
    auto &level = asks_[request.price_ticks];
    level.push_back(order);
    locators_.emplace(request.order_id, Locator{request.side, request.price_ticks, std::prev(level.end())});
  }
  emit(tape::MarketEventType::book_update, time, request.order_id, 0, request.price_ticks, remaining,
       request.side == Side::buy);
}

void LimitOrderBook::erase(const Locator &locator) {
  if (locator.side == Side::buy) {
    auto level = bids_.find(locator.price_ticks);
    if (level == bids_.end())
      return;
    level->second.erase(locator.iterator);
    if (level->second.empty())
      bids_.erase(level);
  } else {
    auto level = asks_.find(locator.price_ticks);
    if (level == asks_.end())
      return;
    level->second.erase(locator.iterator);
    if (level->second.empty())
      asks_.erase(level);
  }
}

OrderResult LimitOrderBook::submit(const OrderRequest &request, tape::TimestampNs time) {
  OrderResult result;
  const auto reject = [&](RejectReason reason, const char *text) {
    result.reject_reason = reason;
    emit(tape::MarketEventType::order_rejected, time, request.order_id, 0, request.price_ticks, request.quantity,
         request.side == Side::buy, text);
    return result;
  };
  if (state_ != InstrumentState::open)
    return reject(RejectReason::market_closed, "instrument not open");
  if (request.quantity < config_.minimum_order_size || request.quantity % config_.lot_size != 0)
    return reject(RejectReason::invalid_quantity, "invalid quantity");
  if (request.type == OrderType::limit && (request.price_ticks <= 0 || request.price_ticks % config_.tick_size != 0))
    return reject(RejectReason::invalid_price, "invalid price tick");
  if (locators_.contains(request.order_id))
    return reject(RejectReason::duplicate_order, "duplicate active order id");
  if (request.post_only && marketable(request))
    return reject(RejectReason::post_only_would_trade, "post-only order would trade");
  if (request.time_in_force == TimeInForce::fill_or_kill && available(request) < request.quantity)
    return reject(RejectReason::fok_unfilled, "insufficient executable quantity");
  result.accepted = true;
  emit(tape::MarketEventType::order_accepted, time, request.order_id, 0, request.price_ticks, request.quantity,
       request.side == Side::buy);
  Quantity remaining = request.quantity;

  while (remaining > 0 &&
         marketable(OrderRequest{request.order_id, request.agent_id, request.side, request.type, request.time_in_force,
                                 request.price_ticks, remaining, request.post_only, request.send_time_ns})) {
    OrderList *level = request.side == Side::buy ? &asks_.begin()->second : &bids_.begin()->second;
    auto maker_iterator = level->begin();
    if (maker_iterator->agent_id == request.agent_id) {
      const auto maker_id = maker_iterator->order_id;
      const auto maker_locator = locators_.at(maker_id);
      if (config_.stp_mode == StpMode::cancel_newest) {
        emit(tape::MarketEventType::order_cancelled, time, request.order_id, maker_id, request.price_ticks, remaining,
             request.side == Side::buy, "self-trade prevention: newest");
        result.reject_reason = RejectReason::self_trade;
        break;
      }
      erase(maker_locator);
      locators_.erase(maker_id);
      emit(tape::MarketEventType::order_cancelled, time, maker_id, request.order_id, maker_locator.price_ticks, 0,
           request.side == Side::buy, "self-trade prevention: oldest");
      if (config_.stp_mode == StpMode::cancel_both) {
        result.reject_reason = RejectReason::self_trade;
        break;
      }
      continue;
    }
    const Quantity matched = std::min(remaining, maker_iterator->remaining_quantity);
    const PriceTicks price = maker_iterator->price_ticks;
    const OrderId maker_id = maker_iterator->order_id;
    const AgentId maker_agent = maker_iterator->agent_id;
    maker_iterator->remaining_quantity -= matched;
    remaining -= matched;
    emit(tape::MarketEventType::trade, time, request.order_id, maker_id, price, matched, request.side == Side::buy);
    result.fills.push_back(
        {sequence_, maker_id, request.order_id, maker_agent, request.agent_id, price, matched, request.side, time});
    if (maker_iterator->remaining_quantity == 0) {
      const auto locator = locators_.at(maker_id);
      erase(locator);
      locators_.erase(maker_id);
    }
  }
  result.filled_quantity = request.quantity - remaining;
  if (remaining > 0 && request.type == OrderType::limit && request.time_in_force == TimeInForce::good_til_cancel &&
      result.reject_reason == RejectReason::none) {
    rest(request, remaining, time);
    result.resting_quantity = remaining;
  } else if (remaining > 0) {
    emit(tape::MarketEventType::order_cancelled, time, request.order_id, 0, request.price_ticks, remaining,
         request.side == Side::buy, "unfilled remainder cancelled");
  }
  return result;
}

bool LimitOrderBook::cancel(OrderId order_id, AgentId agent_id, tape::TimestampNs time) {
  const auto found = locators_.find(order_id);
  if (found == locators_.end() || found->second.iterator->agent_id != agent_id)
    return false;
  const auto locator = found->second;
  const auto quantity = locator.iterator->remaining_quantity;
  erase(locator);
  locators_.erase(found);
  emit(tape::MarketEventType::order_cancelled, time, order_id, 0, locator.price_ticks, quantity,
       locator.side == Side::buy);
  return true;
}

OrderResult LimitOrderBook::replace(OrderId order_id, AgentId agent_id, PriceTicks price, Quantity quantity,
                                    tape::TimestampNs time) {
  const auto found = locators_.find(order_id);
  if (found == locators_.end() || found->second.iterator->agent_id != agent_id) {
    OrderResult output;
    output.reject_reason = RejectReason::unknown_order;
    return output;
  }
  auto &current = *found->second.iterator;
  if (price == current.price_ticks && quantity <= current.remaining_quantity &&
      quantity >= config_.minimum_order_size && quantity % config_.lot_size == 0) {
    current.remaining_quantity = quantity;
    current.original_quantity = quantity;
    emit(tape::MarketEventType::order_replaced, time, order_id, 0, price, quantity, current.side == Side::buy,
         "priority retained: quantity reduction");
    return {true, RejectReason::none, 0, quantity, {}};
  }
  const auto side = current.side;
  (void)cancel(order_id, agent_id, time);
  auto output = submit(
      {order_id, agent_id, side, OrderType::limit, TimeInForce::good_til_cancel, price, quantity, false, time}, time);
  if (output.accepted)
    emit(tape::MarketEventType::order_replaced, time, order_id, 0, price, quantity, side == Side::buy,
         "priority reset");
  return output;
}

L1Snapshot LimitOrderBook::l1() const {
  L1Snapshot output;
  output.sequence = sequence_;
  if (!bids_.empty()) {
    Quantity quantity = 0;
    for (const auto &order : bids_.begin()->second)
      quantity += order.remaining_quantity;
    output.bid = Level{bids_.begin()->first, quantity, bids_.begin()->second.size()};
  }
  if (!asks_.empty()) {
    Quantity quantity = 0;
    for (const auto &order : asks_.begin()->second)
      quantity += order.remaining_quantity;
    output.ask = Level{asks_.begin()->first, quantity, asks_.begin()->second.size()};
  }
  return output;
}

std::vector<Level> LimitOrderBook::l2(Side side, std::size_t depth) const {
  std::vector<Level> output;
  const auto append = [&](const auto &levels) {
    for (const auto &[price, orders] : levels) {
      if (output.size() >= depth)
        break;
      Quantity quantity = 0;
      for (const auto &order : orders)
        quantity += order.remaining_quantity;
      output.push_back({price, quantity, orders.size()});
    }
  };
  if (side == Side::buy)
    append(bids_);
  else
    append(asks_);
  return output;
}
std::vector<RestingOrder> LimitOrderBook::l3(Side side, std::size_t depth) const {
  std::vector<RestingOrder> output;
  const auto append = [&](const auto &levels) {
    for (const auto &[price, orders] : levels) {
      (void)price;
      for (const auto &order : orders) {
        if (output.size() >= depth)
          return;
        output.push_back(order);
      }
    }
  };
  if (side == Side::buy)
    append(bids_);
  else
    append(asks_);
  return output;
}
std::optional<RestingOrder> LimitOrderBook::order(OrderId id) const {
  const auto found = locators_.find(id);
  return found == locators_.end() ? std::nullopt : std::optional<RestingOrder>(*found->second.iterator);
}
std::optional<QueuePosition> LimitOrderBook::queue_position(OrderId id) const {
  const auto found = locators_.find(id);
  if (found == locators_.end())
    return std::nullopt;
  Quantity ahead = 0, behind = 0;
  std::size_t rank = 1;
  bool seen = false;
  const auto collect = [&](const auto &levels) {
    const auto level = levels.find(found->second.price_ticks);
    if (level == levels.end())
      return;
    for (const auto &order : level->second) {
      if (order.order_id == id) {
        seen = true;
        continue;
      }
      if (!seen) {
        ahead += order.remaining_quantity;
        ++rank;
      } else
        behind += order.remaining_quantity;
    }
  };
  if (found->second.side == Side::buy)
    collect(bids_);
  else
    collect(asks_);
  return QueuePosition{ahead, behind, rank, found->second.iterator->accepted_time_ns};
}

void LimitOrderBook::set_state(InstrumentState next, tape::TimestampNs time) {
  state_ = next;
  emit(next == InstrumentState::halted ? tape::MarketEventType::halt : tape::MarketEventType::reopen, time, 0, 0, 0, 0,
       false);
}
bool LimitOrderBook::invariant_holds() const {
  if (!bids_.empty() && !asks_.empty() && bids_.begin()->first >= asks_.begin()->first)
    return false;
  std::size_t count = 0;
  const auto valid = [&](const auto &levels) {
    for (const auto &[price, orders] : levels) {
      if (price <= 0 || orders.empty())
        return false;
      for (const auto &order : orders) {
        if (order.remaining_quantity <= 0 || order.price_ticks != price)
          return false;
        ++count;
      }
    }
    return true;
  };
  return valid(bids_) && valid(asks_) && count == locators_.size();
}
BookStateSnapshot LimitOrderBook::snapshot_state() const {
  return {state_, sequence_, last_event_time_ns_, l3(Side::buy, locators_.size()), l3(Side::sell, locators_.size()),
          events_};
}
void LimitOrderBook::restore_state(const BookStateSnapshot &snapshot) {
  bids_.clear();
  asks_.clear();
  locators_.clear();
  events_ = snapshot.events;
  state_ = snapshot.state;
  sequence_ = snapshot.sequence;
  last_event_time_ns_ = snapshot.last_event_time_ns;
  const auto load = [&](const RestingOrder &order) {
    if (order.remaining_quantity <= 0)
      throw std::invalid_argument("snapshot contains inactive order");
    if (order.side == Side::buy) {
      auto &level = bids_[order.price_ticks];
      level.push_back(order);
      locators_.emplace(order.order_id, Locator{order.side, order.price_ticks, std::prev(level.end())});
    } else {
      auto &level = asks_[order.price_ticks];
      level.push_back(order);
      locators_.emplace(order.order_id, Locator{order.side, order.price_ticks, std::prev(level.end())});
    }
  };
  for (const auto &order : snapshot.bids)
    load(order);
  for (const auto &order : snapshot.asks)
    load(order);
  if (!invariant_holds())
    throw std::invalid_argument("snapshot violates book invariants");
}
} // namespace cult::exchange
