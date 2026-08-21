#pragma once
#include "cult/core/types.hpp"
#include <span>
#include <vector>

namespace cult::expression {
struct Prevalence { double raw_probability{}; double raw_per_million{}; double smoothed_probability{}; double smoothed_per_million{}; };
struct DirectionalSignals { double velocity{}; double acceleration{}; double breadth{}; double signed_breadth{}; double persistence{}; double persistence_strength{}; };
struct AuthorConcentration { std::uint64_t documents{}; std::uint64_t unique_authors{}; double largest_author_share{}; double top_ten_author_share{}; double effective_authors{}; };
struct ProportionInterval { double lower{}; double upper{}; double level{0.95}; };
[[nodiscard]] Prevalence prevalence(std::uint64_t expression_documents,std::uint64_t eligible_documents);
[[nodiscard]] double log_prevalence_return(double current_smoothed_probability,double previous_smoothed_probability);
[[nodiscard]] DirectionalSignals signals(std::span<const double> platform_returns,std::span<const double> platform_weights,std::span<const double> recent_aggregate_returns,double previous_velocity);
[[nodiscard]] AuthorConcentration author_concentration(std::span<const std::uint64_t> author_document_counts);
[[nodiscard]] ProportionInterval wilson_interval(std::uint64_t expression_documents,std::uint64_t eligible_documents,double z=1.959963984540054);
}
