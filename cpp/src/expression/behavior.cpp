#include "cult/expression/behavior.hpp"
#include <algorithm>
#include <cmath>
#include <numeric>
#include <set>
#include <stdexcept>

namespace cult::expression {
namespace {
constexpr double kNsPerSecond = 1'000'000'000.0;
double percentile(std::vector<double> values, double probability) {
  if (values.empty())
    return 0.0;
  std::sort(values.begin(), values.end());
  const double position = probability * static_cast<double>(values.size() - 1U);
  const auto lower = static_cast<std::size_t>(std::floor(position));
  const auto upper = static_cast<std::size_t>(std::ceil(position));
  const double fraction = position - static_cast<double>(lower);
  return values[lower] * (1.0 - fraction) + values[upper] * fraction;
}
} // namespace

BehaviorAccumulator::BehaviorAccumulator(BehaviorConfig config) : config_(config) {
  if (!(config_.half_life_seconds > 0.0))
    throw std::invalid_argument("attention half-life must be positive");
}

void BehaviorAccumulator::apply(const tape::ExpressionEvent &event) {
  if (event.expression_ids.empty())
    return;
  const double attribution = config_.attribution == tape::AttributionMode::fractional
                                 ? 1.0 / static_cast<double>(event.expression_ids.size())
                                 : 1.0;
  const double engagement =
      attribution * (config_.weights.like * std::log1p(static_cast<double>(event.delta.likes)) +
                     config_.weights.repost * std::log1p(static_cast<double>(event.delta.reposts)) +
                     config_.weights.quote * std::log1p(static_cast<double>(event.delta.quotes)) +
                     config_.weights.reply * std::log1p(static_cast<double>(event.delta.replies)));

  for (const auto expression_id : event.expression_ids) {
    auto &state = states_[expression_id];
    if (event.type == tape::ExpressionEventType::create) {
      ++state.creation_flow;
      state.created_posts.insert(event.id);
      state.creation_times.push_back(event.event_time_ns);
    }
    state.like_flow += event.delta.likes;
    state.repost_flow += event.delta.reposts;
    state.quote_flow += event.delta.quotes;
    state.reply_flow += event.delta.replies;
    if (engagement > 0.0)
      state.engaged_cascades.insert(event.cascade_id);

    auto [iterator, inserted] = state.cascades.try_emplace(event.cascade_id);
    auto &cascade = iterator->second;
    if (inserted) {
      cascade.id = event.cascade_id;
      cascade.root_id = event.parent_cascade_id.value_or(event.cascade_id);
      cascade.created_at_ns = event.event_time_ns;
    }
    cascade.last_event_ns = std::max(cascade.last_event_ns, event.event_time_ns);
    cascade.size += event.type == tape::ExpressionEventType::create ? 1U : 0U;
    cascade.breadth += event.type == tape::ExpressionEventType::repost ||
                               event.type == tape::ExpressionEventType::quote ||
                               event.type == tape::ExpressionEventType::reply
                           ? 1U
                           : 0U;
    cascade.depth = std::max<std::uint64_t>(cascade.depth, event.parent_cascade_id.has_value() ? 2U : 1U);
    cascade.attention += engagement;
  }
}

BehaviorState BehaviorAccumulator::snapshot(ExpressionId expression_id, tape::TimestampNs now_ns) const {
  BehaviorState output;
  output.expression_id = expression_id;
  const auto found = states_.find(expression_id);
  if (found == states_.end())
    return output;
  const auto &state = found->second;
  output.creation_flow = state.creation_flow;
  output.like_flow = state.like_flow;
  output.repost_flow = state.repost_flow;
  output.quote_flow = state.quote_flow;
  output.reply_flow = state.reply_flow;
  output.post_breadth = state.created_posts.size();
  output.engagement_breadth = state.engaged_cascades.size();
  output.cascade_breadth = state.cascades.size();
  const double lambda = std::log(2.0) / config_.half_life_seconds;
  std::vector<double> contributions;
  for (const auto &[id, cascade] : state.cascades) {
    (void)id;
    const double age = std::max(0.0, static_cast<double>(now_ns - cascade.last_event_ns) / kNsPerSecond);
    contributions.push_back(cascade.attention * std::exp(-lambda * age));
  }
  output.amplification = std::accumulate(contributions.begin(), contributions.end(), 0.0);
  const double primary = static_cast<double>(std::max<std::uint64_t>(1U, state.creation_flow));
  output.propagation_ratio = static_cast<double>(state.repost_flow + state.quote_flow) / primary;
  if (output.amplification > 0.0) {
    double hhi = 0.0;
    for (const double contribution : contributions) {
      const double share = contribution / output.amplification;
      hhi += share * share;
      output.largest_cascade_share = std::max(output.largest_cascade_share, share);
    }
    output.cascade_hhi = hhi;
    output.effective_cascades = hhi > 0.0 ? 1.0 / hhi : 0.0;
  }
  return output;
}

ArrivalStatistics BehaviorAccumulator::arrival_statistics(ExpressionId expression_id,
                                                          tape::TimestampNs window_ns) const {
  ArrivalStatistics output;
  const auto found = states_.find(expression_id);
  if (found == states_.end() || found->second.creation_times.size() < 2U || window_ns <= 0)
    return output;
  const auto &times = found->second.creation_times;
  std::vector<double> intervals;
  for (std::size_t index = 1; index < times.size(); ++index)
    intervals.push_back(static_cast<double>(times[index] - times[index - 1]) / kNsPerSecond);
  output.mean_interarrival_seconds =
      std::accumulate(intervals.begin(), intervals.end(), 0.0) / static_cast<double>(intervals.size());
  output.median_interarrival_seconds = percentile(intervals, 0.5);
  output.p95_interarrival_seconds = percentile(intervals, 0.95);
  const double variance = intervals.size() > 1U
                              ? std::accumulate(intervals.begin(), intervals.end(), 0.0,
                                                [mean = output.mean_interarrival_seconds](double sum, double value) {
                                                  return sum + (value - mean) * (value - mean);
                                                }) /
                                    static_cast<double>(intervals.size() - 1U)
                              : 0.0;
  const double sigma = std::sqrt(variance);
  output.burstiness = sigma + output.mean_interarrival_seconds > 0.0
                          ? (sigma - output.mean_interarrival_seconds) / (sigma + output.mean_interarrival_seconds)
                          : 0.0;
  const auto first = times.front();
  const auto last = times.back();
  const auto bucket_count = static_cast<std::size_t>((last - first) / window_ns) + 1U;
  std::vector<double> counts(bucket_count, 0.0);
  for (const auto timestamp : times)
    ++counts[static_cast<std::size_t>((timestamp - first) / window_ns)];
  const double mean_count = std::accumulate(counts.begin(), counts.end(), 0.0) / static_cast<double>(counts.size());
  double count_variance = 0.0;
  for (const double count : counts)
    count_variance += (count - mean_count) * (count - mean_count);
  count_variance = counts.size() > 1U ? count_variance / static_cast<double>(counts.size() - 1U) : 0.0;
  output.fano_factor = mean_count > 0.0 ? count_variance / mean_count : 0.0;
  output.zero_window_probability =
      static_cast<double>(std::count(counts.begin(), counts.end(), 0.0)) / static_cast<double>(counts.size());
  return output;
}

DataLiquidityTier BehaviorAccumulator::liquidity_tier(ExpressionId expression_id) const {
  const auto found = states_.find(expression_id);
  if (found == states_.end() || found->second.creation_times.size() < 2U)
    return DataLiquidityTier::insufficient;
  const auto stats = arrival_statistics(expression_id, 1'000'000'000LL);
  if (stats.median_interarrival_seconds <= 1.0 && stats.zero_window_probability <= 0.50)
    return DataLiquidityTier::hft_eligible;
  if (stats.median_interarrival_seconds <= 15.0)
    return DataLiquidityTier::fast;
  if (stats.median_interarrival_seconds <= 300.0)
    return DataLiquidityTier::intraday;
  return DataLiquidityTier::slow;
}
} // namespace cult::expression
