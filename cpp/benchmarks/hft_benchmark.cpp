#include "cult/exchange/order_book.hpp"
#include "cult/exchange/simulator.hpp"
#include "cult/exchange/strategy.hpp"
#include <algorithm>
#include <chrono>
#include <cstdlib>
#include <iostream>
#include <string_view>

namespace {
using Clock = std::chrono::steady_clock;
template <class Work> void measure(std::string_view label, std::uint64_t operations, Work work) {
  const auto start = Clock::now();
  work();
  const double elapsed = std::chrono::duration<double>(Clock::now() - start).count();
  std::cout << label << " operations=" << operations << " elapsed_seconds=" << elapsed
            << " operations_per_second=" << static_cast<double>(operations) / elapsed << '\n';
}
} // namespace
int main(int argc, char **argv) {
  using namespace cult::exchange;
  const std::uint64_t n = argc > 1 ? std::strtoull(argv[1], nullptr, 10) : 1'000'000ULL;
  std::cout << "CULT deterministic HFT benchmark\n";
  measure("insert_cancel", n, [&] {
    LimitOrderBook book({1});
    for (std::uint64_t i = 0; i < n; ++i) {
      const auto id = i + 1;
      (void)book.submit({id, 1, Side::buy, OrderType::limit, TimeInForce::good_til_cancel, 999, 10, false,
                         static_cast<cult::tape::TimestampNs>(i)},
                        static_cast<cult::tape::TimestampNs>(i));
      (void)book.cancel(id, 1, static_cast<cult::tape::TimestampNs>(i));
    }
    if (!book.invariant_holds())
      std::abort();
  });
  measure("cancel_replace", n, [&] {
    LimitOrderBook book({1});
    const OrderId id = 1;
    (void)book.submit({id, 1, Side::buy, OrderType::limit, TimeInForce::good_til_cancel, 999, 20, false, 0}, 0);
    for (std::uint64_t i = 0; i < n; ++i)
      (void)book.replace(id, 1, 999, static_cast<Quantity>(20 - (i & 1U)), static_cast<cult::tape::TimestampNs>(i));
    if (!book.invariant_holds())
      std::abort();
  });
  measure("matches", n, [&] {
    LimitOrderBook book({1});
    OrderId id = 1;
    for (std::uint64_t i = 0; i < n; ++i) {
      (void)book.submit({id++, 1, Side::sell, OrderType::limit, TimeInForce::good_til_cancel, 1001, 1, false,
                         static_cast<cult::tape::TimestampNs>(i)},
                        static_cast<cult::tape::TimestampNs>(i));
      (void)book.submit({id++, 2, Side::buy, OrderType::market, TimeInForce::immediate_or_cancel, 0, 1, false,
                         static_cast<cult::tape::TimestampNs>(i)},
                        static_cast<cult::tape::TimestampNs>(i));
    }
    if (!book.invariant_holds())
      std::abort();
  });
  const std::uint64_t lighter = std::max<std::uint64_t>(1, n / 10U);
  measure("l2_snapshots", lighter, [&] {
    LimitOrderBook book({1});
    for (std::uint64_t i = 0; i < 20; ++i)
      (void)book.submit({i + 1, 1, Side::buy, OrderType::limit, TimeInForce::good_til_cancel,
                         999 - static_cast<PriceTicks>(i), 10, false, 0},
                        0);
    for (std::uint64_t i = 0; i < lighter; ++i)
      (void)book.l2(Side::buy, 10);
  });
  measure("scheduler", lighter, [&] {
    DeterministicScheduler scheduler;
    std::uint64_t callbacks = 0;
    for (std::uint64_t i = 0; i < lighter; ++i)
      scheduler.schedule(static_cast<cult::tape::TimestampNs>(lighter - i), [&] { ++callbacks; });
    scheduler.run();
    if (callbacks != lighter)
      std::abort();
  });
  measure("strategy_callbacks", n, [&] {
    OrderSink sink;
    SimpleMarketMaker strategy(10, 2, 0.01);
    StrategyContext context{0, 1000, {1000, 2, 2, 1000, 0, 0, 100, 100}, 0, 100000, sink};
    cult::tape::MarketEvent event;
    for (std::uint64_t i = 0; i < n; ++i) {
      strategy.on_market_data(event, context);
      sink.clear();
    }
  });
  return EXIT_SUCCESS;
}
