#include "cult/analytics/streaming.hpp"
#include "cult/expression/metrics.hpp"
#include "cult/expression/registry.hpp"
#include "cult/index/reference_index.hpp"

#include <chrono>
#include <cstdint>
#include <iomanip>
#include <iostream>
#include <random>
#include <string>
#include <vector>

namespace {
template <typename Operation>
double measure(Operation operation) {
  const auto start = std::chrono::steady_clock::now();
  operation();
  return std::chrono::duration<double>(std::chrono::steady_clock::now() - start).count();
}

void report(const char* name, std::size_t count, double seconds) {
  std::cout << name << ".elapsed_seconds=" << seconds << '\n'
            << name << ".operations_per_second=" << static_cast<double>(count) / seconds << '\n';
}
}  // namespace

int main(int argc, char** argv) {
  std::size_t count = 1'000'000;
  if (argc > 1) count = static_cast<std::size_t>(std::stoull(argv[1]));
  std::mt19937_64 random(20260821);
  std::normal_distribution<double> normal(0, 0.01);
  std::vector<double> first(count), second(count);
  for (std::size_t index = 0; index < count; ++index) {
    first[index] = normal(random);
    second[index] = 0.4 * first[index] + normal(random);
  }

  cult::analytics::RollingMoments moments(1440);
  cult::analytics::RollingCovariance covariance(1440);
  double prevalence_sink = 0.0;
  const auto streaming_seconds = measure([&] {
    for (std::size_t index = 0; index < count; ++index) {
      moments.push(first[index]);
      covariance.push(first[index], second[index]);
      prevalence_sink += cult::expression::prevalence(static_cast<std::uint64_t>(index % 100), 100'000)
                             .smoothed_probability;
    }
  });

  const auto utf8 = [](const char8_t* value) {
    return std::string(reinterpret_cast<const char*>(value));
  };
  cult::expression::EmojiRegistry registry({
      {1, "expr_cry", utf8(u8"😭"), {utf8(u8"😭")}, cult::expression::VariantPolicy::exact},
      {2, "expr_skull", utf8(u8"💀"), {utf8(u8"💀")}, cult::expression::VariantPolicy::exact},
      {3, "expr_heart", utf8(u8"❤️"), {utf8(u8"❤️"), utf8(u8"❤")},
       cult::expression::VariantPolicy::strip_variation_selector},
  });
  const std::string document = utf8(u8"bro really thought that would work 😭😭 💀");
  std::size_t match_sink = 0;
  const auto matching_seconds = measure([&] {
    for (std::size_t index = 0; index < count; ++index) match_sink += registry.extract(document).size();
  });

  cult::index::ReferencePoint reference;
  const std::vector<double> weights{1.0};
  const auto index_seconds = measure([&] {
    for (std::size_t index = 0; index < count; ++index) {
      const std::vector<double> platform_return{first[index]};
      reference = cult::index::chain_link(
          reference, cult::index::weighted_platform_return(platform_return, weights));
    }
  });

  std::cout << std::fixed << std::setprecision(3) << "observations=" << count << '\n';
  report("streaming_analytics", count, streaming_seconds);
  report("expression_matching_documents", count, matching_seconds);
  report("reference_index_updates", count, index_seconds);
  std::cout << "rolling_mean=" << moments.mean() << '\n'
            << "rolling_variance=" << moments.variance() << '\n'
            << "rolling_correlation=" << covariance.correlation() << '\n'
            << "sink=" << prevalence_sink + static_cast<double>(match_sink) + reference.value << '\n';
}
