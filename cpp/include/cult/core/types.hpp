#pragma once
#include <cstdint>
#include <string>

namespace cult {
using ExpressionId = std::uint32_t;
using PlatformId = std::uint16_t;
using WindowId = std::uint64_t;
using TimestampMs = std::int64_t;

inline constexpr const char* kCoipMethodologyVersion = "COIP-1";
inline constexpr const char* kRegistryVersion = "EMOJI-17.0-CULT-V1";
inline constexpr const char* kReferenceMethodologyVersion = "REF-JEFFREYS-1";

enum class SourceHealthState : std::uint8_t { healthy, degraded, stale, disconnected, backfilling };

struct ExpressionObservation {
  ExpressionId expression_id{};
  PlatformId platform_id{};
  TimestampMs timestamp_ms{};
  std::uint64_t eligible_documents{};
  std::uint64_t expression_documents{};
  std::uint64_t occurrence_count{};
  std::uint64_t unique_author_estimate{};
  double raw_prevalence{};
  double smoothed_prevalence{};
};

struct SourceHealth {
  SourceHealthState state{SourceHealthState::disconnected};
  TimestampMs last_event_timestamp_ms{};
  TimestampMs last_receive_timestamp_ms{};
  std::int64_t stream_lag_ms{};
  std::uint64_t events_per_minute{};
  std::uint64_t parse_errors{};
  std::uint64_t duplicate_events{};
  std::uint64_t reconnect_count{};
};
}
