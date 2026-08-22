#include "cult/exchange/simulator.hpp"
#include "cult/exchange/strategy.hpp"
#include <algorithm>
#include <cmath>
#include <limits>
#include <stdexcept>

namespace cult::exchange {
void DeterministicScheduler::schedule(tape::TimestampNs time, Action action) {
  if (time < now_ns_)
    throw std::invalid_argument("cannot schedule in the past");
  queue_.push({time, ++sequence_, std::move(action)});
}
bool DeterministicScheduler::step() {
  if (queue_.empty())
    return false;
  auto next = queue_.top();
  queue_.pop();
  now_ns_ = next.time_ns;
  next.action();
  return true;
}
void DeterministicScheduler::run() {
  while (step()) {
  }
}
LatencyModel::LatencyModel(LatencyConfig config, std::uint64_t seed) : config_(std::move(config)), rng_(seed) {
  if (config_.base_ns < 0 || config_.jitter_ns < 0)
    throw std::invalid_argument("latency cannot be negative");
}
tape::TimestampNs LatencyModel::sample() {
  switch (config_.kind) {
  case LatencyKind::constant:
    return config_.base_ns;
  case LatencyKind::uniform_jitter: {
    std::uniform_int_distribution<tape::TimestampNs> d(-config_.jitter_ns, config_.jitter_ns);
    return std::max<tape::TimestampNs>(0, config_.base_ns + d(rng_));
  }
  case LatencyKind::lognormal: {
    std::lognormal_distribution<double> d(std::log(std::max(1.0, static_cast<double>(config_.base_ns))),
                                          config_.lognormal_sigma);
    return static_cast<tape::TimestampNs>(d(rng_));
  }
  case LatencyKind::empirical: {
    if (config_.empirical_ns.empty())
      return config_.base_ns;
    std::uniform_int_distribution<std::size_t> d(0, config_.empirical_ns.size() - 1U);
    return config_.empirical_ns[d(rng_)];
  }
  }
  return config_.base_ns;
}
MicrostructureSnapshot microstructure(const LimitOrderBook &book) {
  MicrostructureSnapshot out;
  const auto l1 = book.l1();
  if (!l1.bid || !l1.ask)
    return out;
  out.midpoint_ticks = (static_cast<double>(l1.bid->price_ticks) + static_cast<double>(l1.ask->price_ticks)) / 2.0;
  out.spread_ticks = static_cast<double>(l1.ask->price_ticks - l1.bid->price_ticks);
  out.relative_spread_bps = out.midpoint_ticks > 0.0 ? 10000.0 * out.spread_ticks / out.midpoint_ticks : 0.0;
  const double bid_size = static_cast<double>(l1.bid->quantity), ask_size = static_cast<double>(l1.ask->quantity),
               total = bid_size + ask_size;
  out.microprice_ticks = total > 0.0 ? ((static_cast<double>(l1.ask->price_ticks) * bid_size +
                                         static_cast<double>(l1.bid->price_ticks) * ask_size) /
                                        total)
                                     : out.midpoint_ticks;
  out.imbalance_l1 = total > 0.0 ? (bid_size - ask_size) / total : 0.0;
  for (const auto &level : book.l2(Side::buy, 5))
    out.bid_depth_l5 += level.quantity;
  for (const auto &level : book.l2(Side::sell, 5))
    out.ask_depth_l5 += level.quantity;
  const double depth = static_cast<double>(out.bid_depth_l5 + out.ask_depth_l5);
  out.imbalance_l5 = depth > 0.0 ? static_cast<double>(out.bid_depth_l5 - out.ask_depth_l5) / depth : 0.0;
  return out;
}
double trade_imbalance(const TradeFlow &flow) {
  const auto total = flow.buy_aggressive + flow.sell_aggressive;
  return total ? static_cast<double>(flow.buy_aggressive - flow.sell_aggressive) / static_cast<double>(total) : 0.0;
}
Quantity order_flow_imbalance(const BestLevelChange &c) {
  const Quantity bid_component =
      c.bid > c.previous_bid ? c.bid_size
                             : (c.bid == c.previous_bid ? c.bid_size - c.previous_bid_size : -c.previous_bid_size);
  const Quantity ask_component =
      c.ask < c.previous_ask ? c.ask_size
                             : (c.ask == c.previous_ask ? c.ask_size - c.previous_ask_size : -c.previous_ask_size);
  return bid_component - ask_component;
}
double effective_spread_ticks(const Fill &fill, double mid) {
  const double direction = fill.aggressor_side == Side::buy ? 1.0 : -1.0;
  return 2.0 * direction * (static_cast<double>(fill.price_ticks) - mid);
}
Markout markout(const Fill &fill, double future_mid, tape::TimestampNs horizon) {
  const double value = fill.aggressor_side == Side::buy ? future_mid - static_cast<double>(fill.price_ticks)
                                                        : static_cast<double>(fill.price_ticks) - future_mid;
  return {horizon, value};
}
RiskDecision PreTradeRisk::check(const OrderRequest &r, const AccountState &a, PriceTicks mid, SourceHealthState health,
                                 std::uint64_t messages) const {
  if (a.killed)
    return RiskDecision::killed;
  if (health == SourceHealthState::stale || health == SourceHealthState::disconnected)
    return RiskDecision::source_health;
  if (r.quantity > limits_.maximum_order_size)
    return RiskDecision::order_size;
  const Quantity signed_quantity = r.side == Side::buy ? r.quantity : -r.quantity;
  if (std::abs(a.position + signed_quantity) > limits_.maximum_position)
    return RiskDecision::position;
  const PriceTicks price = r.type == OrderType::market ? mid : r.price_ticks;
  if (std::abs(price - mid) > limits_.collar_ticks)
    return RiskDecision::collar;
  const double proposed = std::abs(static_cast<double>(a.position + signed_quantity) * static_cast<double>(mid));
  if (proposed > limits_.maximum_gross_exposure)
    return RiskDecision::exposure;
  if (a.equity <= 0.0 || proposed / a.equity > limits_.maximum_leverage)
    return RiskDecision::leverage;
  if (messages >= limits_.maximum_messages_per_second)
    return RiskDecision::message_rate;
  return RiskDecision::accept;
}
const char *risk_decision_name(RiskDecision decision) noexcept {
  switch (decision) {
  case RiskDecision::accept:
    return "ACCEPT";
  case RiskDecision::killed:
    return "KILLED";
  case RiskDecision::order_size:
    return "ORDER_SIZE";
  case RiskDecision::position:
    return "POSITION";
  case RiskDecision::exposure:
    return "EXPOSURE";
  case RiskDecision::leverage:
    return "LEVERAGE";
  case RiskDecision::collar:
    return "COLLAR";
  case RiskDecision::message_rate:
    return "MESSAGE_RATE";
  case RiskDecision::source_health:
    return "SOURCE_HEALTH";
  }
  return "UNKNOWN";
}
bool should_halt(double previous_mid, double current_mid, double reference_return, double data_quality,
                 const HaltConfig &config) {
  if (previous_mid <= 0.0 || current_mid <= 0.0)
    return true;
  return std::abs(current_mid / previous_mid - 1.0) > config.maximum_market_move ||
         std::abs(reference_return) > config.maximum_reference_shock || data_quality < config.minimum_data_quality;
}
std::optional<PriceTicks> reopening_auction_price(const std::vector<AuctionOrder> &orders) {
  if (orders.empty())
    return std::nullopt;
  std::vector<PriceTicks> prices;
  for (const auto &order : orders)
    if (order.price_ticks > 0 && order.quantity > 0)
      prices.push_back(order.price_ticks);
  if (prices.empty())
    return std::nullopt;
  std::sort(prices.begin(), prices.end());
  prices.erase(std::unique(prices.begin(), prices.end()), prices.end());
  PriceTicks best = prices.front();
  Quantity best_volume = -1;
  Quantity best_imbalance = std::numeric_limits<Quantity>::max();
  for (const auto price : prices) {
    Quantity buys = 0, sells = 0;
    for (const auto &order : orders) {
      if (order.side == Side::buy && order.price_ticks >= price)
        buys += order.quantity;
      if (order.side == Side::sell && order.price_ticks <= price)
        sells += order.quantity;
    }
    const Quantity volume = std::min(buys, sells), imbalance = std::abs(buys - sells);
    if (volume > best_volume ||
        (volume == best_volume && (imbalance < best_imbalance || (imbalance == best_imbalance && price < best)))) {
      best = price;
      best_volume = volume;
      best_imbalance = imbalance;
    }
  }
  return best;
}

ScenarioReport run_great_cry_shock(std::uint64_t seed, bool concentrated, bool spam_like,
                                   PreTradeLimits risk_limits, double reference_price) {
  constexpr ExpressionId cry = 1;
  constexpr tape::TimestampNs second = 1'000'000'000LL;
  expression::BehaviorAccumulator behavior({{}, 900.0, tape::AttributionMode::fractional});
  std::mt19937_64 rng(seed);
  std::uint64_t event_id = 0;
  const std::size_t posts = concentrated ? 10U : 80U;
  for (std::size_t i = 0; i < posts; ++i) {
    const auto cascade = concentrated ? 1ULL : static_cast<std::uint64_t>(i + 1U);
    const auto post_record_id = event_id + 1U;
    behavior.apply({++event_id,
                    static_cast<tape::TimestampNs>(i) * second,
                    static_cast<tape::TimestampNs>(i) * second + 1'000'000,
                    1,
                    {cry},
                    tape::ExpressionEventType::create,
                    tape::ContentType::original,
                    "en",
                    cascade,
                    std::nullopt,
                    post_record_id,
                    {},
                    false});
    const std::uint64_t scale = concentrated ? 80U : 10U;
    behavior.apply({++event_id,
                    static_cast<tape::TimestampNs>(i) * second + 100'000'000,
                    static_cast<tape::TimestampNs>(i) * second + 101'000'000,
                    1,
                    {cry},
                    tape::ExpressionEventType::repost,
                    tape::ContentType::ineligible,
                    "en",
                    cascade,
                    post_record_id,
                    std::nullopt,
                    {scale, scale / 2U, scale / 4U, scale / 3U},
                    false});
  }
  auto state = behavior.snapshot(cry, static_cast<tape::TimestampNs>(posts) * second);
  if (spam_like) {
    state.effective_cascades = 1.0;
    state.cascade_hhi = 1.0;
    state.largest_cascade_share = 1.0;
  }
  // The book is centered on the instrument's actual current price, not a
  // hardcoded fixture value -- see the header comment on reference_price.
  const auto base_tick = static_cast<PriceTicks>(std::llround(reference_price));
  LimitOrderBook book({cry, 1, 1, 1, StpMode::cancel_newest});
  std::uint64_t order_id = 0;
  for (int level = 1; level <= 5; ++level) {
    (void)book.submit(
        {++order_id, 1, Side::buy, OrderType::limit, TimeInForce::good_til_cancel, base_tick - level, 1000, false, 0},
        0);
    (void)book.submit(
        {++order_id, 2, Side::sell, OrderType::limit, TimeInForce::good_til_cancel, base_tick + level, 1000, false,
         0},
        0);
  }
  const double information =
      std::log1p(state.amplification) * (1.0 - state.largest_cascade_share) * (spam_like ? 0.1 : 1.0);
  const double reference = reference_price + std::clamp(information, 0.0, reference_price * 0.02);
  const auto decision_time = static_cast<tape::TimestampNs>(posts) * second;

  // SIGNAL EVENT: the behavior engine's output becomes a real signal, not a
  // report-only scalar consumed by nothing.
  tape::EventTape<tape::SignalEvent> signal_tape;
  signal_tape.append(
      {1, decision_time, cry, tape::SignalType::amplification_shock, information, information});

  // AGENT RECEIVES SIGNAL, after AGENT LATENCY.
  LatencyModel agent_latency({LatencyKind::constant, 2'000'000, 0, 0.25, {}}, seed);
  const auto agent_receive_time = decision_time + agent_latency.sample();
  const auto market_before = microstructure(book);
  EventDrivenAgent agent;
  OrderSink sink;
  StrategyContext context{agent_receive_time, reference, market_before, 0, 0.0, sink};
  agent.on_signal(signal_tape.events().back(), context);

  // STRATEGY DECISION -> intent, not yet an order the exchange has seen.
  OrderResult trade{};
  RiskDecision risk_decision = RiskDecision::accept;
  if (!sink.orders().empty()) {
    const auto &intent = sink.orders().front();
    // ORDER LATENCY, then PRE-TRADE RISK, before CULT-X ever sees the order.
    LatencyModel order_latency({LatencyKind::constant, 3'000'000, 0, 0.25, {}}, seed + 1U);
    const auto send_time = agent_receive_time + order_latency.sample();
    const OrderRequest request{++order_id,          3, intent.side,          intent.type,
                               intent.time_in_force, intent.price_ticks, intent.quantity, intent.post_only,
                               send_time};
    // Sized for this simulated venue's desk, not a universal production
    // default: covers the sizing formula's max notional so an ordinary
    // shock clears risk, while cpp/tests exercises a real rejection via a
    // deliberately tightened `risk_limits`. Account equity and the dollar
    // (not ratio) risk limit scale with reference_price so leverage/margin
    // checks behave the same regardless of which instrument's actual price
    // this scenario was seeded with -- maximumLeverage/maximumOrderSize/
    // maximumPosition are already scale-invariant ratios/quantities.
    const double price_scale = reference_price / 1000.0;
    const AccountState account{2'000'000.0 * price_scale, 0, 2'000'000.0 * price_scale, 0.0, false};
    PreTradeLimits scaled_limits = risk_limits;
    scaled_limits.maximum_gross_exposure *= price_scale;
    risk_decision = PreTradeRisk(scaled_limits)
                        .check(request, account, static_cast<PriceTicks>(std::llround(market_before.midpoint_ticks)),
                               SourceHealthState::healthy, 1);
    if (risk_decision == RiskDecision::accept) {
      trade = book.submit(request, send_time);
      for (const auto &fill : trade.fills)
        agent.on_fill(fill, context);
    }
  }
  const auto market = microstructure(book);
  const double mid = market.midpoint_ticks;
  std::uint64_t hash = 1469598103934665603ULL;
  for (const auto &event : book.events()) {
    hash ^= event.sequence;
    hash *= 1099511628211ULL;
    hash ^= static_cast<std::uint64_t>(event.price_ticks);
    hash *= 1099511628211ULL;
    hash ^= static_cast<std::uint64_t>(event.quantity);
    hash *= 1099511628211ULL;
  }
  return {spam_like ? "CRY SPAM SHOCK" : (concentrated ? "CRY CELEBRITY SHOCK" : "THE GREAT CRY SHOCK"),
          seed,
          static_cast<std::size_t>(event_id),
          signal_tape.size(),
          book.events().size(),
          trade.fills.size(),
          state,
          market,
          reference,
          mid,
          reference > 0.0 ? mid / reference - 1.0 : 0.0,
          risk_decision,
          hash};
}
LatencyOutcome run_latency_arbitrage(tape::TimestampNs cancel_latency_ns) {
  LimitOrderBook book({1});
  (void)book.submit({1, 1, Side::buy, OrderType::limit, TimeInForce::good_til_cancel, 999, 100, false, 0}, 0);
  (void)book.submit({2, 1, Side::sell, OrderType::limit, TimeInForce::good_til_cancel, 1001, 100, false, 0}, 0);
  DeterministicScheduler scheduler;
  Quantity filled = 0;
  constexpr tape::TimestampNs fast_order = 5'000'000;
  scheduler.schedule(cancel_latency_ns, [&] { (void)book.cancel(2, 1, cancel_latency_ns); });
  scheduler.schedule(fast_order, [&] {
    const auto result = book.submit(
        {3, 2, Side::buy, OrderType::market, TimeInForce::immediate_or_cancel, 0, 50, false, fast_order}, fast_order);
    filled = result.filled_quantity;
  });
  scheduler.run();
  const double markout = filled > 0 ? -9.0 : 0.0;
  std::uint64_t hash = 1469598103934665603ULL;
  for (const auto &event : book.events()) {
    hash ^= event.sequence;
    hash *= 1099511628211ULL;
  }
  return {cancel_latency_ns, filled > 0, filled, markout, hash};
}
QueueTradeoff run_queue_tradeoff() {
  LimitOrderBook join({1});
  (void)join.submit({1, 9, Side::buy, OrderType::limit, TimeInForce::good_til_cancel, 999, 100, false, 0}, 0);
  (void)join.submit({2, 1, Side::buy, OrderType::limit, TimeInForce::good_til_cancel, 999, 50, false, 1}, 1);
  const auto join_position = join.queue_position(2).value();
  const auto join_fill =
      join.submit({3, 2, Side::sell, OrderType::market, TimeInForce::immediate_or_cancel, 0, 50, false, 2}, 2);
  const bool join_strategy_fill = std::any_of(join_fill.fills.begin(), join_fill.fills.end(),
                                              [](const Fill &fill) { return fill.maker_order_id == 2; });
  LimitOrderBook improve({1});
  (void)improve.submit({1, 9, Side::buy, OrderType::limit, TimeInForce::good_til_cancel, 999, 100, false, 0}, 0);
  (void)improve.submit({2, 1, Side::buy, OrderType::limit, TimeInForce::good_til_cancel, 1000, 50, false, 1}, 1);
  const auto improve_position = improve.queue_position(2).value();
  const auto improve_fill =
      improve.submit({3, 2, Side::sell, OrderType::market, TimeInForce::immediate_or_cancel, 0, 50, false, 2}, 2);
  const bool improve_strategy_fill = std::any_of(improve_fill.fills.begin(), improve_fill.fills.end(),
                                                 [](const Fill &fill) { return fill.maker_order_id == 2; });
  return {join_strategy_fill,
          improve_strategy_fill,
          join_position.quantity_ahead,
          improve_position.quantity_ahead,
          join_strategy_fill ? 1.0 : 0.0,
          improve_strategy_fill ? 0.0 : 0.0};
}
} // namespace cult::exchange
