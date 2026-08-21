#pragma once

#include "cult/exchange/order_book.hpp"
#include "cult/expression/behavior.hpp"
#include <cstdint>
#include <functional>
#include <optional>
#include <queue>
#include <random>
#include <string>
#include <vector>

namespace cult::exchange {
class DeterministicScheduler {
public:
  using Action = std::function<void()>;
  void schedule(tape::TimestampNs time_ns, Action action);
  bool step();
  void run();
  [[nodiscard]] tape::TimestampNs now() const noexcept { return now_ns_; }
  [[nodiscard]] std::size_t pending() const noexcept { return queue_.size(); }

private:
  struct Scheduled {
    tape::TimestampNs time_ns;
    std::uint64_t sequence;
    Action action;
  };
  struct Compare {
    bool operator()(const Scheduled &left, const Scheduled &right) const {
      return left.time_ns != right.time_ns ? left.time_ns > right.time_ns : left.sequence > right.sequence;
    }
  };
  std::priority_queue<Scheduled, std::vector<Scheduled>, Compare> queue_;
  tape::TimestampNs now_ns_{};
  std::uint64_t sequence_{};
};

enum class LatencyKind : std::uint8_t { constant, uniform_jitter, lognormal, empirical };
struct LatencyConfig {
  LatencyKind kind{LatencyKind::constant};
  tape::TimestampNs base_ns{};
  tape::TimestampNs jitter_ns{};
  double lognormal_sigma{0.25};
  std::vector<tape::TimestampNs> empirical_ns;
};
class LatencyModel {
public:
  LatencyModel(LatencyConfig config, std::uint64_t seed);
  [[nodiscard]] tape::TimestampNs sample();

private:
  LatencyConfig config_;
  std::mt19937_64 rng_;
};

struct MicrostructureSnapshot {
  double midpoint_ticks{};
  double spread_ticks{};
  double relative_spread_bps{};
  double microprice_ticks{};
  double imbalance_l1{};
  double imbalance_l5{};
  Quantity bid_depth_l5{};
  Quantity ask_depth_l5{};
};
[[nodiscard]] MicrostructureSnapshot microstructure(const LimitOrderBook &book);

struct TradeFlow {
  Quantity buy_aggressive{};
  Quantity sell_aggressive{};
};
[[nodiscard]] double trade_imbalance(const TradeFlow &flow);
struct BestLevelChange {
  PriceTicks previous_bid{};
  Quantity previous_bid_size{};
  PriceTicks bid{};
  Quantity bid_size{};
  PriceTicks previous_ask{};
  Quantity previous_ask_size{};
  PriceTicks ask{};
  Quantity ask_size{};
};
[[nodiscard]] Quantity order_flow_imbalance(const BestLevelChange &change);

struct Markout {
  tape::TimestampNs horizon_ns{};
  double ticks{};
};
[[nodiscard]] double effective_spread_ticks(const Fill &fill, double midpoint_at_fill);
[[nodiscard]] Markout markout(const Fill &fill, double future_midpoint, tape::TimestampNs horizon_ns);

struct PreTradeLimits {
  Quantity maximum_order_size{10000};
  Quantity maximum_position{50000};
  double maximum_gross_exposure{2'000'000.0};
  double maximum_leverage{2.0};
  PriceTicks collar_ticks{100};
  std::uint64_t maximum_messages_per_second{10000};
};
struct AccountState {
  double cash{100'000.0};
  Quantity position{};
  double equity{100'000.0};
  double gross_exposure{};
  bool killed{};
};
enum class RiskDecision : std::uint8_t {
  accept,
  killed,
  order_size,
  position,
  exposure,
  leverage,
  collar,
  message_rate,
  source_health
};
class PreTradeRisk {
public:
  explicit PreTradeRisk(PreTradeLimits limits = {}) : limits_(limits) {}
  [[nodiscard]] RiskDecision check(const OrderRequest &request, const AccountState &account, PriceTicks midpoint,
                                   SourceHealthState health, std::uint64_t recent_messages) const;

private:
  PreTradeLimits limits_;
};
class KillSwitch {
public:
  void trigger(std::string reason) {
    killed_ = true;
    reason_ = std::move(reason);
  }
  [[nodiscard]] bool killed() const noexcept { return killed_; }
  [[nodiscard]] const std::string &reason() const noexcept { return reason_; }

private:
  bool killed_{};
  std::string reason_;
};
struct HaltConfig {
  double maximum_market_move{0.10};
  double maximum_reference_shock{0.15};
  double minimum_data_quality{0.25};
};
[[nodiscard]] bool should_halt(double previous_mid, double current_mid, double reference_return, double data_quality,
                               const HaltConfig &config = {});
struct AuctionOrder {
  Side side{Side::buy};
  PriceTicks price_ticks{};
  Quantity quantity{};
};
[[nodiscard]] std::optional<PriceTicks> reopening_auction_price(const std::vector<AuctionOrder> &orders);

struct ScenarioReport {
  std::string name;
  std::uint64_t seed{};
  std::size_t expression_events{};
  std::size_t signal_events{};
  std::size_t market_events{};
  std::size_t trades{};
  expression::BehaviorState behavior;
  MicrostructureSnapshot market;
  double reference{};
  double market_mid{};
  double basis_percent{};
  std::uint64_t output_hash{};
};
[[nodiscard]] ScenarioReport run_great_cry_shock(std::uint64_t seed, bool concentrated, bool spam_like);
struct LatencyOutcome {
  tape::TimestampNs cancel_latency_ns{};
  bool stale_quote_filled{};
  Quantity filled_quantity{};
  double maker_markout_ticks{};
  std::uint64_t output_hash{};
};
[[nodiscard]] LatencyOutcome run_latency_arbitrage(tape::TimestampNs cancel_latency_ns);
struct QueueTradeoff {
  bool join_best_filled{};
  bool improve_one_tick_filled{};
  Quantity join_quantity_ahead{};
  Quantity improve_quantity_ahead{};
  double join_pnl_ticks{};
  double improve_pnl_ticks{};
};
[[nodiscard]] QueueTradeoff run_queue_tradeoff();
} // namespace cult::exchange
