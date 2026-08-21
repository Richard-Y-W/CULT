#include "cult/exchange/order_book.hpp"
#include <cstdlib>
#include <iostream>
#include <random>
#include <vector>

int main() {
  using namespace cult::exchange;
  std::mt19937_64 rng(20260821);
  LimitOrderBook book({1, 1, 1, 1, StpMode::cancel_newest});
  struct Submitted {
    OrderId id;
    AgentId agent;
  };
  std::vector<Submitted> submitted;
  OrderId next = 1;
  for (std::size_t step = 0; step < 50'000; ++step) {
    if ((rng() % 5U) == 0U && !submitted.empty()) {
      const auto &chosen = submitted[static_cast<std::size_t>(rng() % submitted.size())];
      (void)book.cancel(chosen.id, chosen.agent, static_cast<cult::tape::TimestampNs>(step));
    } else {
      const Side side = (rng() & 1U) == 0U ? Side::buy : Side::sell;
      const bool aggressive = (rng() % 7U) == 0U;
      const PriceTicks price = side == Side::buy ? (aggressive ? 1005 : 990 + static_cast<PriceTicks>(rng() % 10U))
                                                 : (aggressive ? 995 : 1001 + static_cast<PriceTicks>(rng() % 10U));
      const auto type = aggressive ? OrderType::market : OrderType::limit;
      const auto tif = aggressive ? TimeInForce::immediate_or_cancel : TimeInForce::good_til_cancel;
      const auto agent = static_cast<AgentId>(rng() % 100U + 1U);
      const auto id = next++;
      const auto result = book.submit({id, agent, side, type, tif, price, static_cast<Quantity>(rng() % 100U + 1U),
                                       false, static_cast<cult::tape::TimestampNs>(step)},
                                      static_cast<cult::tape::TimestampNs>(step));
      if (result.resting_quantity > 0)
        submitted.push_back({id, agent});
    }
    if (step % 100U == 0U && !book.invariant_holds()) {
      std::cerr << "order-book invariant failed at step " << step << '\n';
      return EXIT_FAILURE;
    }
  }
  if (!book.invariant_holds())
    return EXIT_FAILURE;
  std::cout << "50,000 deterministic randomized order-book operations passed\n";
  return EXIT_SUCCESS;
}
