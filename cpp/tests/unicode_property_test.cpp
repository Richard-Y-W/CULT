#include "cult/expression/registry.hpp"

#include <cstddef>
#include <cstdint>
#include <iostream>
#include <random>
#include <string>
#include <vector>

int main() {
  const auto utf8 = [](const char8_t* value) {
    return std::string(reinterpret_cast<const char*>(value));
  };
  cult::expression::EmojiRegistry registry({
      {1, "expr_heart", utf8(u8"❤️"), {utf8(u8"❤️"), utf8(u8"❤")},
       cult::expression::VariantPolicy::strip_variation_selector},
      {2, "expr_pray", utf8(u8"🙏"), {utf8(u8"🙏"), utf8(u8"🙏🏽")},
       cult::expression::VariantPolicy::aggregate_skin_tones},
      {3, "expr_family", utf8(u8"👨‍👩‍👧‍👦"), {utf8(u8"👨‍👩‍👧‍👦")},
       cult::expression::VariantPolicy::exact},
  });

  std::mt19937_64 random(20260821);
  std::uniform_int_distribution<int> length_distribution(0, 4096);
  std::uniform_int_distribution<int> byte_distribution(0, 255);
  for (std::size_t trial = 0; trial < 10'000; ++trial) {
    std::string hostile(static_cast<std::size_t>(length_distribution(random)), '\0');
    for (auto& byte : hostile) byte = static_cast<char>(byte_distribution(random));
    const auto first = registry.extract(hostile);
    const auto second = registry.extract(hostile);
    if (first.size() != second.size()) {
      std::cerr << "Non-deterministic result for hostile UTF-8 input\n";
      return 1;
    }
  }

  std::string combining = "x";
  const auto acute = utf8(u8"\u0301");
  for (std::size_t index = 0; index < 100'000; ++index) combining += acute;
  if (!registry.extract(combining).empty()) {
    std::cerr << "Combining-only input produced a false emoji match\n";
    return 1;
  }

  std::cout << "10,000 deterministic hostile UTF-8 cases passed\n";
  return 0;
}
