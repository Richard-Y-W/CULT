#pragma once
#include "cult/core/types.hpp"
#include <optional>
#include <span>
#include <string>

namespace cult::index {
enum class IndexStatus : std::uint8_t { provisional, official, revised };
struct QualityComponents { std::optional<double> sample_adequacy; std::optional<double> source_coverage; std::optional<double> source_health; std::optional<double> cross_source_agreement; std::optional<double> author_concentration; std::optional<double> missingness; };
struct ReferencePoint { double value{1000.0}; double aggregate_return{}; IndexStatus status{IndexStatus::provisional}; bool is_final{}; std::uint32_t revision_number{}; std::string methodology_version{kReferenceMethodologyVersion}; };
[[nodiscard]] double weighted_platform_return(std::span<const double> returns,std::span<const double> weights);
[[nodiscard]] ReferencePoint chain_link(const ReferencePoint& previous,double aggregate_return,bool is_final=false);
[[nodiscard]] std::optional<double> data_quality_score(const QualityComponents& components);
}
