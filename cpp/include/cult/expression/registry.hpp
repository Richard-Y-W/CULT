#pragma once
#include "cult/core/types.hpp"
#include <string>
#include <string_view>
#include <optional>
#include <vector>

namespace cult::expression {
enum class VariantPolicy : std::uint8_t { exact, strip_variation_selector, aggregate_skin_tones };
struct RegistryEntry { ExpressionId id{}; std::string stable_id; std::string canonical_utf8; std::vector<std::string> sequences_utf8; VariantPolicy policy{VariantPolicy::exact}; };
struct MatchResult { ExpressionId expression_id{}; std::string stable_id; std::size_t occurrences{}; std::vector<std::string> raw_forms; };
class EmojiRegistry {
 public:
  explicit EmojiRegistry(std::vector<RegistryEntry> entries);
  [[nodiscard]] std::vector<MatchResult> extract(std::string_view utf8) const;
  [[nodiscard]] std::size_t size() const noexcept { return entries_.size(); }
 private:
  std::vector<RegistryEntry> entries_;
};
}
