#pragma once

#include "cult/tape/events.hpp"
#include <cstddef>
#include <cstdint>
#include <deque>
#include <map>
#include <set>
#include <vector>

namespace cult::expression {
struct EngagementWeights {
  double like{1.0};
  double repost{3.0};
  double quote{4.0};
  double reply{2.0};
};
struct BehaviorConfig {
  EngagementWeights weights{};
  double half_life_seconds{900.0};
  tape::AttributionMode attribution{tape::AttributionMode::fractional};
};
struct CascadeState {
  tape::CascadeId id{};
  tape::CascadeId root_id{};
  tape::TimestampNs created_at_ns{};
  tape::TimestampNs last_event_ns{};
  std::uint64_t size{};
  std::uint64_t depth{};
  std::uint64_t breadth{};
  double attention{};
};
struct BehaviorState {
  ExpressionId expression_id{};
  std::uint64_t creation_flow{};
  std::uint64_t like_flow{};
  std::uint64_t repost_flow{};
  std::uint64_t quote_flow{};
  std::uint64_t reply_flow{};
  std::uint64_t post_breadth{};
  std::uint64_t engagement_breadth{};
  std::uint64_t cascade_breadth{};
  double amplification{};
  double propagation_ratio{};
  double cascade_hhi{};
  double effective_cascades{};
  double largest_cascade_share{};
};
struct ArrivalStatistics {
  double mean_interarrival_seconds{};
  double median_interarrival_seconds{};
  double p95_interarrival_seconds{};
  double fano_factor{};
  double burstiness{};
  double zero_window_probability{};
};
enum class DataLiquidityTier : std::uint8_t { hft_eligible, fast, intraday, slow, insufficient };

class BehaviorAccumulator {
public:
  explicit BehaviorAccumulator(BehaviorConfig config = {});
  void apply(const tape::ExpressionEvent &event);
  [[nodiscard]] BehaviorState snapshot(ExpressionId expression_id, tape::TimestampNs now_ns) const;
  [[nodiscard]] ArrivalStatistics arrival_statistics(ExpressionId expression_id, tape::TimestampNs window_ns) const;
  [[nodiscard]] DataLiquidityTier liquidity_tier(ExpressionId expression_id) const;

private:
  struct ExpressionState {
    std::uint64_t creation_flow{};
    std::uint64_t like_flow{};
    std::uint64_t repost_flow{};
    std::uint64_t quote_flow{};
    std::uint64_t reply_flow{};
    std::set<tape::EventId> created_posts;
    std::set<tape::CascadeId> engaged_cascades;
    std::map<tape::CascadeId, CascadeState> cascades;
    std::vector<tape::TimestampNs> creation_times;
  };
  BehaviorConfig config_;
  std::map<ExpressionId, ExpressionState> states_;
};
} // namespace cult::expression
