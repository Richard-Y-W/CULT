#include "cult/analytics/streaming.hpp"
#include "cult/backtest/engine.hpp"
#include "cult/exchange/order_book.hpp"
#include "cult/exchange/simulation_api.hpp"
#include "cult/exchange/simulator.hpp"
#include "cult/exchange/strategy.hpp"
#include "cult/expression/behavior.hpp"
#include "cult/expression/metrics.hpp"
#include "cult/expression/registry.hpp"
#include "cult/index/reference_index.hpp"
#include "cult/market/virtual_liquidity.hpp"
#include <cmath>
#include <cstdlib>
#include <iostream>
#include <numeric>
#include <stdexcept>
#include <string>
#include <vector>

namespace {
int failures = 0;
void check(bool value, const char *label) {
  if (!value) {
    std::cerr << "FAIL: " << label << '\n';
    ++failures;
  }
}
void near(double a, double b, double tolerance, const char *label) { check(std::abs(a - b) <= tolerance, label); }
} // namespace
int main() {
  using namespace cult;
  const auto utf8 = [](const char8_t *value) { return std::string(reinterpret_cast<const char *>(value)); };
  const std::vector<double> values{100, 110, 121};
  const auto returns = analytics::simple_returns(values);
  near(returns[0], .1, 1e-12, "simple return");
  near(analytics::momentum(values, 2), .21, 1e-12, "momentum");
  analytics::OnlineMoments online;
  for (double x : {1., 2., 3.})
    online.push(x);
  near(online.mean(), 2., 1e-12, "online mean");
  near(online.variance(), 1., 1e-12, "online variance");
  analytics::RollingMoments rolling(3);
  for (double x : {1., 2., 3., 4.})
    rolling.push(x);
  near(rolling.mean(), 3., 1e-12, "rolling mean eviction");
  near(rolling.variance(), 1., 1e-12, "rolling variance eviction");
  analytics::RollingCovariance rc(3);
  rc.push(1, 2);
  rc.push(2, 4);
  rc.push(3, 6);
  near(rc.correlation(), 1., 1e-12, "rolling correlation");
  near(rc.beta(), .5, 1e-12, "rolling beta x on y");
  const std::vector<double> entropy_weights{34., 25., 18., 10., 8., 5.};
  check(analytics::normalized_entropy(entropy_weights) > 0.8, "normalized entropy");
  bool entropy_rejected = false;
  try {
    const std::vector<double> bad{1, -1};
    (void)analytics::normalized_entropy(bad);
  } catch (const std::invalid_argument &) {
    entropy_rejected = true;
  }
  check(entropy_rejected, "negative entropy rejected");
  analytics::EwmaMoments ewma_moments(2.0);
  ewma_moments.push(1.0);
  ewma_moments.push(3.0);
  check(ewma_moments.mean().has_value(), "EWMA moments initialized");
  check(ewma_moments.variance() > 0.0, "EWMA variance positive");
  near(analytics::realized_volatility(std::vector<double>{.1, -.2}), std::sqrt(.05), 1e-12, "realized volatility");
  near(analytics::autocorrelation(std::vector<double>{1, 2, 3, 4}, 1), 1.0, 1e-12, "autocorrelation");
  near(analytics::spearman_correlation(std::vector<double>{1, 2, 3}, std::vector<double>{2, 4, 6}), 1.0, 1e-12,
       "Spearman correlation");
  const auto market_factors =
      analytics::market_factors(std::vector<double>{.1, -.05, .02}, std::vector<double>{2, 1, 1});
  near(market_factors.market_return, .0425, 1e-12, "expression market return");
  near(market_factors.breadth, 2.0 / 3.0, 1e-12, "expression market breadth");
  const auto prevalence = expression::prevalence(10, 1000);
  near(prevalence.raw_per_million, 10000., 1e-12, "raw prevalence");
  near(prevalence.smoothed_probability, 10.5 / 1001., 1e-15, "Jeffreys prevalence");
  const auto interval = expression::wilson_interval(10, 100);
  check(interval.lower < .1 && interval.upper > .1, "Wilson interval contains estimate");
  const std::vector<double> platform_returns{.1, -.05, .02}, weights{.5, .3, .2}, recent{.1, .2, -.1};
  const auto signals = expression::signals(platform_returns, weights, recent, .03);
  near(signals.velocity, .039, 1e-12, "weighted velocity");
  near(signals.breadth, .7, 1e-12, "positive breadth");
  near(signals.signed_breadth, .4, 1e-12, "signed breadth");
  near(signals.persistence, 1. / 3., 1e-12, "directional persistence");
  const std::vector<std::uint64_t> authors{5, 3, 2};
  const auto concentration = expression::author_concentration(authors);
  near(concentration.effective_authors, 100. / 38., 1e-12, "effective authors");
  near(concentration.largest_author_share, .5, 1e-12, "largest author share");
  expression::EmojiRegistry registry(
      {{1, "expr_heart", utf8(u8"❤️"), {utf8(u8"❤️"), utf8(u8"❤")}, expression::VariantPolicy::strip_variation_selector},
       {2,
        "expr_family",
        utf8(u8"👨‍👩‍👧‍👦"),
        {utf8(u8"👨‍👩‍👧‍👦")},
        expression::VariantPolicy::exact}});
  const std::string text = utf8(u8"x ❤️❤️ 👨‍👩‍👧‍👦");
  const auto matches = registry.extract(text);
  check(matches.size() == 2, "registry distinct expressions");
  check(matches[0].occurrences == 2, "registry preserves intensity");
  index::ReferencePoint base;
  const auto linked = index::chain_link(base, std::log(1.08));
  near(linked.value, 1080., 1e-10, "chain linked index");
  const auto quality = index::data_quality_score({.9, 1., .8, std::nullopt, .7, 1.});
  check(quality.has_value() && quality.value() > 80., "quality available components");
  market::VirtualLiquidityProvider lp;
  const market::MarketState state{1000, .02, .3, .8};
  const auto quote = lp.quote(state);
  check(quote.bid < quote.mid && quote.mid < quote.ask, "two sided quote");
  near(lp.advance(state, 0, 0).log_premium, .0194, 1e-12, "premium mean reversion");
  check(market::assess_risk({100, 250, 20, 70}, {}) == market::RiskStatus::margin_call, "risk margin call");
  expression::BehaviorAccumulator behavior;
  behavior.apply({1,
                  0,
                  1,
                  1,
                  {1},
                  tape::ExpressionEventType::create,
                  tape::ContentType::original,
                  "en",
                  1,
                  std::nullopt,
                  100,
                  {},
                  false});
  behavior.apply({2,
                  1'000'000'000,
                  1'001'000'000,
                  1,
                  {1},
                  tape::ExpressionEventType::repost,
                  tape::ContentType::ineligible,
                  "en",
                  1,
                  std::nullopt,
                  std::nullopt,
                  {10, 5, 2, 1},
                  false});
  const auto behavior_state = behavior.snapshot(1, 1'000'000'000);
  check(behavior_state.creation_flow == 1, "engagement does not change prevalence creation flow");
  check(behavior_state.repost_flow == 5 && behavior_state.amplification > 0.0,
        "engagement components and amplification");
  expression::BehaviorAccumulator chain;
  chain.apply({10, 0, 1, 1, {1}, tape::ExpressionEventType::create, tape::ContentType::original, "en", 1,
              std::nullopt, 1000, {}, false});
  chain.apply({11, 1, 1, 1, {1}, tape::ExpressionEventType::reply, tape::ContentType::reply, "en", 1, 1000, 1001,
              {}, false});
  chain.apply({12, 2, 1, 1, {1}, tape::ExpressionEventType::quote, tape::ContentType::quote, "en", 1, 1001, 1002,
              {}, false});
  chain.apply({13, 3, 1, 1, {1}, tape::ExpressionEventType::reply, tape::ContentType::reply, "en", 1, 1002,
              std::nullopt, {}, false});
  const auto chain_cascades = chain.cascades(1);
  check(chain_cascades.size() == 1 && chain_cascades.front().depth == 4,
        "recursive cascade depth is not capped at 2");
  {
    const auto accepted = exchange::run_great_cry_shock(20260821ULL, false, false);
    check(accepted.signal_events == 1, "signal_events reflects the real signal tape, not a hardcoded count");
    check(accepted.risk_decision == exchange::RiskDecision::accept && accepted.trades > 0,
          "an ordinary shock clears pre-trade risk and reaches CULT-X");
    const exchange::PreTradeLimits tight{10000, 50000, 1'000.0, 3.0, 100, 10000};
    const auto rejected = exchange::run_great_cry_shock(20260821ULL, false, false, tight);
    check(rejected.risk_decision != exchange::RiskDecision::accept && rejected.trades == 0,
          "pre-trade risk actually rejects an order that breaches a tightened exposure limit");
  }
  {
    exchange::SimulationHandle sim({1, 1, 1, 1, exchange::StpMode::cancel_newest});
    check(sim.status() == exchange::ReplayStatus::idle, "simulation handle starts idle");
    std::vector<tape::ExpressionEvent> events;
    events.push_back({1, 0, 1, 1, {1}, tape::ExpressionEventType::create, tape::ContentType::original, "en", 1,
                      std::nullopt, 100, {}, false});
    events.push_back({2, 1, 1, 1, {1}, tape::ExpressionEventType::reply, tape::ContentType::reply, "en", 1, 100, 101,
                      {}, false});
    sim.load_replay(events);
    check(sim.status() == exchange::ReplayStatus::loaded, "loadReplay queues events without running them");
    sim.run();
    check(sim.status() == exchange::ReplayStatus::finished && sim.cursor() == 2,
          "runReplay steps through the loaded expression tape");
    check(sim.behavior().cascades(1).front().depth == 2, "replayed events reach the behavior accumulator");
    check(sim.instrument_state() == exchange::InstrumentState::open, "getInstrumentState reads the live book state");
    (void)sim.book().submit(
        {1, 1, exchange::Side::buy, exchange::OrderType::limit, exchange::TimeInForce::good_til_cancel, 999, 10,
         false, 0},
        0);
    (void)sim.book().submit(
        {2, 2, exchange::Side::sell, exchange::OrderType::limit, exchange::TimeInForce::good_til_cancel, 1001, 10,
         false, 1},
        1);
    check(sim.l1().bid.has_value() && sim.l1().ask.has_value(), "getL1 reflects the resting book");
    check(sim.l2().bids.size() == 1 && sim.l2().asks.size() == 1, "getL2 reflects the resting book");
    const auto fill = sim.book().submit(
        {3, 3, exchange::Side::buy, exchange::OrderType::market, exchange::TimeInForce::immediate_or_cancel, 0, 5,
         false, 2},
        2);
    check(!fill.fills.empty(), "market order fills against the resting ask");
    sim.record_fill(fill.fills.front());
    check(sim.agent_metrics().fill_count == 1 && sim.agent_metrics().net_position == 5,
          "getAgentMetrics reflects fills recorded against the handle");
    check(!sim.trade_tape().empty(), "getTradeTape reflects book events");
    check(sim.microstructure_metrics().midpoint_ticks > 0.0, "getMicrostructureMetrics is a thin wrapper, not new math");
    sim.emit_signal({1, 2, 1, tape::SignalType::amplification_shock, 1.0, 1.0, "CULT-BEHAVIOR-1"});
    check(sim.signal_tape().size() == 1, "getSignalTape reflects what the caller recorded");
    const exchange::AccountState probe_account{100'000.0, 0, 100'000.0, 0.0, false};
    const auto probe = sim.evaluate_risk(
        {4, 4, exchange::Side::buy, exchange::OrderType::market, exchange::TimeInForce::immediate_or_cancel, 0, 10,
         false, 2},
        probe_account, SourceHealthState::healthy, 1);
    check(probe == exchange::RiskDecision::accept, "getRiskState evaluates a hypothetical order without submitting it");
  }
  exchange::LimitOrderBook book({1, 1, 1, 1, exchange::StpMode::cancel_newest});
  auto bid1 = book.submit({1, 1, exchange::Side::buy, exchange::OrderType::limit,
                           exchange::TimeInForce::good_til_cancel, 100, 10, false, 0},
                          0);
  auto bid2 = book.submit({2, 2, exchange::Side::buy, exchange::OrderType::limit,
                           exchange::TimeInForce::good_til_cancel, 100, 20, false, 1},
                          1);
  check(bid1.resting_quantity == 10 && bid2.resting_quantity == 20, "orders rest");
  const auto queue = book.queue_position(2);
  check(queue.has_value() && queue->quantity_ahead == 10 && queue->rank == 2, "exact queue position");
  auto sell = book.submit({3, 3, exchange::Side::sell, exchange::OrderType::limit,
                           exchange::TimeInForce::immediate_or_cancel, 100, 15, false, 2},
                          2);
  check(sell.fills.size() == 2 && sell.fills[0].maker_order_id == 1 && sell.fills[1].maker_order_id == 2,
        "price time and partial fills");
  check(book.order(2)->remaining_quantity == 15 && book.invariant_holds(), "book conservation invariant");
  auto post_only = book.submit(
      {4, 4, exchange::Side::sell, exchange::OrderType::limit, exchange::TimeInForce::good_til_cancel, 100, 1, true, 3},
      3);
  check(!post_only.accepted && post_only.reject_reason == exchange::RejectReason::post_only_would_trade,
        "post only rejects crossing order");
  {
    // Regression for a pre-live audit finding: a fill_or_kill order must
    // never partially fill. Three asks at the same price from three agents,
    // with the requester's own resting order sandwiched between two others
    // it does not own. Under cancel_newest (this book's STP mode), matching
    // stops the instant it reaches the requester's own order, so only the
    // liquidity ahead of it (30) is actually reachable -- a FOK buy for 50
    // must be rejected outright, not filled for 30 and killed for 20.
    exchange::LimitOrderBook fok_book({1, 1, 1, 1, exchange::StpMode::cancel_newest});
    (void)fok_book.submit({10, 100, exchange::Side::sell, exchange::OrderType::limit,
                           exchange::TimeInForce::good_til_cancel, 100, 30, false, 0},
                          0);
    (void)fok_book.submit({11, 101, exchange::Side::sell, exchange::OrderType::limit,
                           exchange::TimeInForce::good_til_cancel, 100, 10, false, 1},
                          1);
    (void)fok_book.submit({12, 100, exchange::Side::sell, exchange::OrderType::limit,
                           exchange::TimeInForce::good_til_cancel, 100, 60, false, 2},
                          2);
    const auto fok = fok_book.submit({13, 100, exchange::Side::buy, exchange::OrderType::limit,
                                      exchange::TimeInForce::fill_or_kill, 100, 50, false, 3},
                                     3);
    check(!fok.accepted && fok.fills.empty() && fok.filled_quantity == 0 &&
              fok.reject_reason == exchange::RejectReason::fok_unfilled,
          "fill_or_kill rejects outright rather than partially filling when self-trade prevention "
          "would interrupt matching");
  }
  const auto saved = book.snapshot_state();
  exchange::LimitOrderBook restored({1, 1, 1, 1, exchange::StpMode::cancel_newest});
  restored.restore_state(saved);
  check(restored.sequence() == book.sequence() && restored.queue_position(2)->quantity_ahead == 0 &&
            restored.invariant_holds(),
        "book snapshot restore");
  exchange::DeterministicScheduler scheduler;
  std::vector<int> scheduled;
  scheduler.schedule(10, [&] { scheduled.push_back(1); });
  scheduler.schedule(10, [&] { scheduled.push_back(2); });
  scheduler.schedule(5, [&] { scheduled.push_back(0); });
  scheduler.run();
  check(scheduled == std::vector<int>({0, 1, 2}), "deterministic event clock");
  const auto demo1 = exchange::run_great_cry_shock(42, false, false),
             demo2 = exchange::run_great_cry_shock(42, false, false);
  check(demo1.output_hash == demo2.output_hash && demo1.trades > 0, "deterministic Great Cry Shock");
  check(demo1.behavior.effective_cascades > exchange::run_great_cry_shock(42, true, false).behavior.effective_cascades,
        "broad and concentrated shocks differ");
  check(exchange::should_halt(1000, 1200, 0, 1), "volatility halt");
  const auto auction = exchange::reopening_auction_price({{exchange::Side::buy, 101, 10},
                                                          {exchange::Side::buy, 100, 10},
                                                          {exchange::Side::sell, 99, 5},
                                                          {exchange::Side::sell, 100, 12}});
  check(auction.has_value() && auction.value() == 100, "deterministic reopening auction");
  const auto fast = exchange::run_latency_arbitrage(1'000'000), slow = exchange::run_latency_arbitrage(100'000'000);
  check(!fast.stale_quote_filled && slow.stale_quote_filled && slow.maker_markout_ticks < 0,
        "latency creates stale quote adverse selection");
  const auto queue_tradeoff = exchange::run_queue_tradeoff();
  check(!queue_tradeoff.join_best_filled && queue_tradeoff.improve_one_tick_filled &&
            queue_tradeoff.join_quantity_ahead == 100,
        "queue versus price tradeoff");
  const auto twap = exchange::twap_schedule(101, 0, 1000, 10);
  check(twap.size() == 10 && std::accumulate(twap.begin(), twap.end(), exchange::Quantity{},
                                             [](auto sum, const auto &child) { return sum + child.quantity; }) == 101,
        "TWAP conserves parent quantity");
  const auto challenge1 = exchange::run_market_making_challenge(42),
             challenge2 = exchange::run_market_making_challenge(42);
  check(challenge1.size() == 3 && challenge1[0].net_pnl == challenge2[0].net_pnl,
        "deterministic market making challenge");
  std::vector<TimestampMs> timestamps;
  std::vector<double> prices;
  for (std::size_t i = 0; i < 50; ++i) {
    timestamps.push_back(static_cast<TimestampMs>(i));
    prices.push_back(100. + static_cast<double>(i));
    prices.push_back(100. - static_cast<double>(i) * .2);
  }
  backtest::CrossSectionalMomentum strategy(5, 1);
  const auto result = backtest::run(timestamps, prices, 2, strategy);
  check(result.trade_count > 0, "backtest trades");
  check(result.total_return > 0, "backtest momentum result");
  backtest::DataView view(timestamps, prices, 2, 4);
  bool lookahead = false;
  try {
    (void)view.price(5, 0);
  } catch (const std::out_of_range &) {
    lookahead = true;
  }
  check(lookahead, "DataView prevents lookahead");
  if (failures) {
    std::cerr << failures << " C++ test(s) failed\n";
    return EXIT_FAILURE;
  }
  std::cout << "All CULT C++ tests passed\n";
  return EXIT_SUCCESS;
}
