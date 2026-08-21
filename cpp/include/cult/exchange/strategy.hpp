#pragma once

#include "cult/exchange/simulator.hpp"
#include "cult/tape/events.hpp"
#include <cstdint>
#include <string>
#include <vector>

namespace cult::exchange {
struct StrategyOrder {
  Side side{Side::buy};
  OrderType type{OrderType::limit};
  TimeInForce time_in_force{TimeInForce::good_til_cancel};
  PriceTicks price_ticks{};
  Quantity quantity{};
  bool post_only{};
};
class OrderSink {
public:
  void send(StrategyOrder order) { orders_.push_back(order); }
  [[nodiscard]] const std::vector<StrategyOrder> &orders() const noexcept { return orders_; }
  void clear() { orders_.clear(); }

private:
  std::vector<StrategyOrder> orders_;
};
struct StrategyContext {
  tape::TimestampNs now_ns{};
  double reference{};
  MicrostructureSnapshot market{};
  Quantity inventory{};
  double cash{};
  OrderSink &order_sink;
};
class HftStrategy {
public:
  virtual ~HftStrategy() = default;
  virtual void on_market_data(const tape::MarketEvent &, StrategyContext &) = 0;
  virtual void on_signal(const tape::SignalEvent &, StrategyContext &) = 0;
  virtual void on_fill(const Fill &, StrategyContext &) = 0;
};
class SimpleMarketMaker final : public HftStrategy {
public:
  SimpleMarketMaker(Quantity size, PriceTicks half_spread, double inventory_skew_ticks)
      : size_(size), half_spread_(half_spread), inventory_skew_(inventory_skew_ticks) {}
  void on_market_data(const tape::MarketEvent &, StrategyContext &) override;
  void on_signal(const tape::SignalEvent &, StrategyContext &) override;
  void on_fill(const Fill &, StrategyContext &) override;

private:
  Quantity size_;
  PriceTicks half_spread_;
  double inventory_skew_;
};
class ReferenceArbitrageStrategy final : public HftStrategy {
public:
  ReferenceArbitrageStrategy(double threshold, Quantity size) : threshold_(threshold), size_(size) {}
  void on_market_data(const tape::MarketEvent &, StrategyContext &) override {}
  void on_signal(const tape::SignalEvent &, StrategyContext &) override;
  void on_fill(const Fill &, StrategyContext &) override {}

private:
  double threshold_;
  Quantity size_;
};

struct ChildOrder {
  tape::TimestampNs scheduled_time_ns{};
  Quantity quantity{};
};
[[nodiscard]] std::vector<ChildOrder> twap_schedule(Quantity total, tape::TimestampNs start, tape::TimestampNs end,
                                                    std::size_t slices);
[[nodiscard]] std::vector<ChildOrder> vwap_schedule(Quantity total, tape::TimestampNs start, tape::TimestampNs interval,
                                                    const std::vector<double> &profile);
struct ExecutionQuality {
  double arrival_price{};
  double average_fill{};
  double vwap{};
  double implementation_shortfall{};
  double fill_ratio{};
  Quantity filled_quantity{};
};
[[nodiscard]] ExecutionQuality execution_quality(Side side, double arrival_price, Quantity submitted,
                                                 const std::vector<Fill> &fills);

struct CompetitionMetrics {
  std::string strategy;
  double net_pnl{};
  double spread_capture{};
  double adverse_selection{};
  double fees{};
  double inventory_variance{};
  double maximum_drawdown{};
  std::uint64_t message_count{};
  std::uint64_t trades{};
};
[[nodiscard]] std::vector<CompetitionMetrics> run_market_making_challenge(std::uint64_t seed);
} // namespace cult::exchange
