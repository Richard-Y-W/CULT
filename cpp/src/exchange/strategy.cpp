#include "cult/exchange/strategy.hpp"
#include <algorithm>
#include <cmath>
#include <numeric>
#include <stdexcept>

namespace cult::exchange {
void SimpleMarketMaker::on_market_data(const tape::MarketEvent &, StrategyContext &context) {
  if (context.market.midpoint_ticks <= 0.0)
    return;
  const auto skew = static_cast<PriceTicks>(std::llround(inventory_skew_ * static_cast<double>(context.inventory)));
  const auto center = static_cast<PriceTicks>(std::llround(context.market.midpoint_ticks)) - skew;
  context.order_sink.send(
      {Side::buy, OrderType::limit, TimeInForce::good_til_cancel, center - half_spread_, size_, true});
  context.order_sink.send(
      {Side::sell, OrderType::limit, TimeInForce::good_til_cancel, center + half_spread_, size_, true});
}
void SimpleMarketMaker::on_signal(const tape::SignalEvent &signal, StrategyContext &context) {
  if (signal.type == tape::SignalType::attention_block && std::abs(signal.z_score) >= 3.0)
    on_market_data({}, context);
}
void SimpleMarketMaker::on_fill(const Fill &fill, StrategyContext &context) {
  context.inventory += fill.aggressor_side == Side::buy ? -fill.quantity : fill.quantity;
}
void ReferenceArbitrageStrategy::on_signal(const tape::SignalEvent &, StrategyContext &context) {
  if (context.reference <= 0.0 || context.market.midpoint_ticks <= 0.0)
    return;
  const double premium = context.market.midpoint_ticks / context.reference - 1.0;
  if (std::abs(premium) <= threshold_)
    return;
  context.order_sink.send(
      {premium > 0.0 ? Side::sell : Side::buy, OrderType::market, TimeInForce::immediate_or_cancel, 0, size_, false});
}
void EventDrivenAgent::on_signal(const tape::SignalEvent &signal, StrategyContext &context) {
  if (signal.type != tape::SignalType::amplification_shock)
    return;
  const auto quantity = static_cast<Quantity>(
      std::clamp(signal.value * sizing_scale_, static_cast<double>(min_size_), static_cast<double>(max_size_)));
  context.order_sink.send(
      {Side::buy, OrderType::market, TimeInForce::immediate_or_cancel, 0, quantity, false});
}
void EventDrivenAgent::on_fill(const Fill &fill, StrategyContext &) {
  position_ += fill.aggressor_side == Side::buy ? fill.quantity : -fill.quantity;
  ++fills_;
}
std::vector<ChildOrder> twap_schedule(Quantity total, tape::TimestampNs start, tape::TimestampNs end,
                                      std::size_t slices) {
  if (total <= 0 || slices == 0U || end <= start)
    throw std::invalid_argument("invalid TWAP parameters");
  std::vector<ChildOrder> out;
  const Quantity base = total / static_cast<Quantity>(slices), remainder = total % static_cast<Quantity>(slices);
  const auto step = (end - start) / static_cast<tape::TimestampNs>(slices);
  for (std::size_t index = 0; index < slices; ++index)
    out.push_back({start + static_cast<tape::TimestampNs>(index) * step,
                   base + (static_cast<Quantity>(index) < remainder ? 1 : 0)});
  return out;
}
std::vector<ChildOrder> vwap_schedule(Quantity total, tape::TimestampNs start, tape::TimestampNs interval,
                                      const std::vector<double> &profile) {
  if (total <= 0 || interval <= 0 || profile.empty() ||
      std::any_of(profile.begin(), profile.end(), [](double x) { return x < 0.0; }))
    throw std::invalid_argument("invalid VWAP parameters");
  const double sum = std::accumulate(profile.begin(), profile.end(), 0.0);
  if (sum <= 0.0)
    throw std::invalid_argument("VWAP profile must be positive");
  std::vector<ChildOrder> out;
  Quantity assigned = 0;
  for (std::size_t i = 0; i < profile.size(); ++i) {
    Quantity amount = i + 1U == profile.size()
                          ? total - assigned
                          : static_cast<Quantity>(std::llround(static_cast<double>(total) * profile[i] / sum));
    amount = std::max<Quantity>(0, std::min(amount, total - assigned));
    assigned += amount;
    out.push_back({start + static_cast<tape::TimestampNs>(i) * interval, amount});
  }
  return out;
}
ExecutionQuality execution_quality(Side side, double arrival, Quantity submitted, const std::vector<Fill> &fills) {
  ExecutionQuality out;
  out.arrival_price = arrival;
  Quantity filled = 0;
  double notional = 0.0;
  for (const auto &fill : fills) {
    filled += fill.quantity;
    notional += static_cast<double>(fill.price_ticks * fill.quantity);
  }
  out.filled_quantity = filled;
  out.average_fill = filled ? notional / static_cast<double>(filled) : 0.0;
  out.vwap = out.average_fill;
  const double direction = side == Side::buy ? 1.0 : -1.0;
  out.implementation_shortfall = filled ? direction * (out.average_fill - arrival) * static_cast<double>(filled) : 0.0;
  out.fill_ratio = submitted ? static_cast<double>(filled) / static_cast<double>(submitted) : 0.0;
  return out;
}
std::vector<CompetitionMetrics> run_market_making_challenge(std::uint64_t seed) {
  struct Configuration {
    const char *name;
    PriceTicks half_spread;
    double skew;
  };
  const std::vector<Configuration> configurations{
      {"static_spread", 2, 0.0}, {"inventory_skew", 2, 0.02}, {"avellaneda_stoikov_reference", 3, 0.04}};
  std::vector<CompetitionMetrics> results;
  for (const auto &config : configurations) {
    LimitOrderBook book({1, 1, 1, 1, StpMode::cancel_newest});
    std::mt19937_64 rng(seed);
    Quantity inventory = 0;
    double cash = 0.0, spread_capture = 0.0, fees = 0.0, equity_peak = 0.0, max_drawdown = 0.0,
           inventory_square_sum = 0.0;
    std::uint64_t messages = 0, trades = 0, order_id = 100;
    (void)book.submit({1, 90, Side::buy, OrderType::limit, TimeInForce::good_til_cancel, 990, 10000, false, 0}, 0);
    (void)book.submit({2, 91, Side::sell, OrderType::limit, TimeInForce::good_til_cancel, 1010, 10000, false, 0}, 0);
    for (std::uint64_t step = 0; step < 200; ++step) {
      const auto skew = static_cast<PriceTicks>(std::llround(config.skew * static_cast<double>(inventory)));
      const auto bid = 1000 - config.half_spread - skew, ask = 1000 + config.half_spread - skew;
      const OrderId bid_id = ++order_id, ask_id = ++order_id;
      (void)book.submit({bid_id, 10, Side::buy, OrderType::limit, TimeInForce::good_til_cancel, bid, 20, true,
                         static_cast<tape::TimestampNs>(step)},
                        static_cast<tape::TimestampNs>(step));
      (void)book.submit({ask_id, 10, Side::sell, OrderType::limit, TimeInForce::good_til_cancel, ask, 20, true,
                         static_cast<tape::TimestampNs>(step)},
                        static_cast<tape::TimestampNs>(step));
      messages += 2;
      const Side aggressor = (rng() & 1U) == 0U ? Side::buy : Side::sell;
      auto execution =
          book.submit({++order_id, 20 + step, aggressor, OrderType::market, TimeInForce::immediate_or_cancel, 0, 10,
                       false, static_cast<tape::TimestampNs>(step)},
                      static_cast<tape::TimestampNs>(step));
      ++messages;
      for (const auto &fill : execution.fills) {
        if (fill.maker_agent_id != 10)
          continue;
        ++trades;
        const double signed_quantity =
            fill.aggressor_side == Side::buy ? -static_cast<double>(fill.quantity) : static_cast<double>(fill.quantity);
        inventory += static_cast<Quantity>(signed_quantity);
        cash -= signed_quantity * static_cast<double>(fill.price_ticks);
        spread_capture += std::abs(static_cast<double>(fill.price_ticks) - 1000.0) * static_cast<double>(fill.quantity);
        fees += 0.01 * static_cast<double>(fill.quantity);
      }
      (void)book.cancel(bid_id, 10, static_cast<tape::TimestampNs>(step));
      (void)book.cancel(ask_id, 10, static_cast<tape::TimestampNs>(step));
      messages += 2;
      const double equity = cash + static_cast<double>(inventory) * 1000.0 - fees;
      equity_peak = std::max(equity_peak, equity);
      max_drawdown = std::min(max_drawdown, equity - equity_peak);
      inventory_square_sum += static_cast<double>(inventory * inventory);
    }
    const double net = cash + static_cast<double>(inventory) * 1000.0 - fees;
    results.push_back({config.name, net, spread_capture, spread_capture - net - fees, fees,
                       inventory_square_sum / 200.0, max_drawdown, messages, trades});
  }
  return results;
}
} // namespace cult::exchange
