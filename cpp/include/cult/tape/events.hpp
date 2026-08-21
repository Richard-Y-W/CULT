#pragma once

#include "cult/core/types.hpp"
#include <cstdint>
#include <optional>
#include <stdexcept>
#include <string>
#include <utility>
#include <vector>

namespace cult::tape {
using EventId = std::uint64_t;
using CascadeId = std::uint64_t;
using SourceId = std::uint16_t;
using TimestampNs = std::int64_t;

enum class ExpressionEventType : std::uint8_t { create, like, repost, reply, quote, deletion, other };
enum class ContentType : std::uint8_t { original, reply, quote, ineligible };
enum class AttributionMode : std::uint8_t { full, fractional };

struct EngagementDelta {
  std::uint64_t likes{};
  std::uint64_t reposts{};
  std::uint64_t quotes{};
  std::uint64_t replies{};
};

struct ExpressionEvent {
  EventId id{};
  TimestampNs event_time_ns{};
  TimestampNs receive_time_ns{};
  SourceId source_id{};
  std::vector<ExpressionId> expression_ids;
  ExpressionEventType type{ExpressionEventType::other};
  ContentType content_type{ContentType::ineligible};
  std::string language_bucket{"UNKNOWN"};
  CascadeId cascade_id{};
  std::optional<CascadeId> parent_cascade_id;
  EngagementDelta delta;
  bool is_backfill{};
};

enum class SignalType : std::uint8_t {
  prevalence_shock,
  amplification_shock,
  propagation_shock,
  concentration_warning,
  attention_block,
  data_source_degraded
};

struct SignalEvent {
  EventId id{};
  TimestampNs event_time_ns{};
  ExpressionId expression_id{};
  SignalType type{SignalType::prevalence_shock};
  double value{};
  double z_score{};
  std::string methodology_version{"CULT-BEHAVIOR-1"};
};

enum class MarketEventType : std::uint8_t {
  order_accepted,
  order_rejected,
  order_cancelled,
  order_replaced,
  trade,
  book_update,
  halt,
  reopen
};
struct MarketEvent {
  std::uint64_t sequence{};
  TimestampNs exchange_time_ns{};
  MarketEventType type{MarketEventType::book_update};
  std::uint64_t order_id{};
  std::uint64_t contra_order_id{};
  ExpressionId expression_id{};
  std::int64_t price_ticks{};
  std::int64_t quantity{};
  bool buy_aggressor{};
  std::string reason;
};

template <typename Event> class EventTape {
public:
  void append(Event event) {
    if (!events_.empty() && event.event_time_ns < events_.back().event_time_ns) {
      throw std::invalid_argument("event tape time must be nondecreasing");
    }
    events_.push_back(std::move(event));
  }
  [[nodiscard]] const std::vector<Event> &events() const noexcept { return events_; }
  [[nodiscard]] std::size_t size() const noexcept { return events_.size(); }

private:
  std::vector<Event> events_;
};

template <> class EventTape<MarketEvent> {
public:
  void append(MarketEvent event) {
    if (!events_.empty() &&
        (event.exchange_time_ns < events_.back().exchange_time_ns || event.sequence <= events_.back().sequence)) {
      throw std::invalid_argument("market tape ordering violation");
    }
    events_.push_back(std::move(event));
  }
  [[nodiscard]] const std::vector<MarketEvent> &events() const noexcept { return events_; }
  [[nodiscard]] std::size_t size() const noexcept { return events_.size(); }

private:
  std::vector<MarketEvent> events_;
};
} // namespace cult::tape
