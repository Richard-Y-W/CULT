#include "cult/exchange/simulator.hpp"
#include "cult/exchange/strategy.hpp"
#include <cstdlib>
#include <iostream>
#include <string>

int main(int argc, char **argv) {
  const std::string scenario = argc > 1 ? argv[1] : "great-cry";
  const std::uint64_t seed = argc > 2 ? std::strtoull(argv[2], nullptr, 10) : 20260821ULL;
  if (scenario == "latency") {
    std::cout << "{\"scenario\":\"LATENCY ARBITRAGE\",\"outcomes\":[";
    bool first = true;
    for (const auto latency : {1'000'000LL, 5'000'000LL, 25'000'000LL, 100'000'000LL, 500'000'000LL}) {
      const auto outcome = cult::exchange::run_latency_arbitrage(latency);
      if (!first)
        std::cout << ',';
      first = false;
      std::cout << "{\"cancelLatencyNs\":" << latency
                << ",\"staleQuoteFilled\":" << (outcome.stale_quote_filled ? "true" : "false")
                << ",\"filledQuantity\":" << outcome.filled_quantity
                << ",\"makerMarkoutTicks\":" << outcome.maker_markout_ticks << "}";
    }
    std::cout << "]}\n";
    return EXIT_SUCCESS;
  }
  if (scenario == "queue") {
    const auto outcome = cult::exchange::run_queue_tradeoff();
    std::cout << "{\"scenario\":\"QUEUE VS PRICE\",\"joinBestFilled\":" << (outcome.join_best_filled ? "true" : "false")
              << ",\"improveFilled\":" << (outcome.improve_one_tick_filled ? "true" : "false")
              << ",\"joinQuantityAhead\":" << outcome.join_quantity_ahead
              << ",\"improveQuantityAhead\":" << outcome.improve_quantity_ahead << "}\n";
    return EXIT_SUCCESS;
  }
  if (scenario == "market-making") {
    const auto results = cult::exchange::run_market_making_challenge(seed);
    std::cout << "{\"scenario\":\"MARKET MAKING CHALLENGE\",\"results\":[";
    for (std::size_t i = 0; i < results.size(); ++i) {
      if (i)
        std::cout << ',';
      const auto &result = results[i];
      std::cout << "{\"strategy\":\"" << result.strategy << "\",\"netPnl\":" << result.net_pnl
                << ",\"spreadCapture\":" << result.spread_capture
                << ",\"adverseSelection\":" << result.adverse_selection << ",\"fees\":" << result.fees
                << ",\"inventoryVariance\":" << result.inventory_variance
                << ",\"maxDrawdown\":" << result.maximum_drawdown << ",\"messages\":" << result.message_count
                << ",\"trades\":" << result.trades << "}";
    }
    std::cout << "]}\n";
    return EXIT_SUCCESS;
  }
  const bool concentrated = scenario == "celebrity";
  const bool spam = scenario == "spam";
  const auto report = cult::exchange::run_great_cry_shock(seed, concentrated, spam);
  std::cout << "{\"scenario\":\"" << report.name << "\",\"seed\":" << report.seed
            << ",\"expressionEvents\":" << report.expression_events << ",\"signalEvents\":" << report.signal_events
            << ",\"marketEvents\":" << report.market_events << ",\"trades\":" << report.trades
            << ",\"reference\":" << report.reference << ",\"marketMid\":" << report.market_mid
            << ",\"basisPercent\":" << report.basis_percent << ",\"amplification\":" << report.behavior.amplification
            << ",\"propagation\":" << report.behavior.propagation_ratio
            << ",\"cascadeHhi\":" << report.behavior.cascade_hhi
            << ",\"effectiveCascades\":" << report.behavior.effective_cascades
            << ",\"spreadTicks\":" << report.market.spread_ticks
            << ",\"micropriceTicks\":" << report.market.microprice_ticks
            << ",\"imbalanceL1\":" << report.market.imbalance_l1 << ",\"riskDecision\":\""
            << cult::exchange::risk_decision_name(report.risk_decision) << "\",\"outputHash\":\""
            << report.output_hash << "\"}\n";
}
