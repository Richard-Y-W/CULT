#pragma once

#include "cult/exchange/simulator.hpp"
#include "cult/expression/behavior.hpp"
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <vector>

namespace cult::exchange {

enum class ReplayStatus : std::uint8_t { idle, loaded, running, paused, finished };

struct L2Snapshot {
  std::vector<Level> bids;
  std::vector<Level> asks;
};

struct AgentMetrics {
  Quantity net_position{};
  std::uint64_t fill_count{};
};

// Coarse-grained facade over a single instrument's order book + behavior
// state, so a product/API/binding layer crosses the boundary once per batch
// operation (loadReplay/run/getL2/...) instead of once per scalar (see
// docs/architecture/native-bindings.md). It wraps LimitOrderBook and
// BehaviorAccumulator directly and adds no new simulation math of its own
// -- decisions (agent/strategy/risk) remain the caller's responsibility, as
// in run_great_cry_shock; this class only replays expression events and
// exposes state, it does not decide or submit orders on its own.
class SimulationHandle {
public:
  explicit SimulationHandle(InstrumentConfig config) : book_(config) {}

  // loadReplay
  void load_replay(std::vector<tape::ExpressionEvent> events) {
    expression_tape_ = std::move(events);
    cursor_ = 0;
    status_ = expression_tape_.empty() ? ReplayStatus::finished : ReplayStatus::loaded;
  }
  // stepReplay: applies the next queued expression event to the behavior
  // accumulator. Returns false once the loaded replay is exhausted.
  bool step() {
    if (cursor_ >= expression_tape_.size()) {
      status_ = ReplayStatus::finished;
      return false;
    }
    behavior_.apply(expression_tape_[cursor_]);
    ++cursor_;
    if (status_ != ReplayStatus::paused)
      status_ = cursor_ >= expression_tape_.size() ? ReplayStatus::finished : ReplayStatus::running;
    return true;
  }
  // runReplay: steps until exhausted or paused.
  void run() {
    status_ = ReplayStatus::running;
    while (status_ == ReplayStatus::running)
      if (!step())
        break;
  }
  // pauseReplay / resumeReplay
  void pause() noexcept {
    if (status_ == ReplayStatus::running)
      status_ = ReplayStatus::paused;
  }
  void resume() noexcept {
    if (status_ == ReplayStatus::paused)
      status_ = ReplayStatus::running;
  }
  [[nodiscard]] ReplayStatus status() const noexcept { return status_; }
  [[nodiscard]] std::size_t cursor() const noexcept { return cursor_; }

  // getInstrumentState
  [[nodiscard]] InstrumentState instrument_state() const { return book_.state(); }
  // getL1
  [[nodiscard]] L1Snapshot l1() const { return book_.l1(); }
  // getL2
  [[nodiscard]] L2Snapshot l2(std::size_t depth = 10) const {
    return {book_.l2(Side::buy, depth), book_.l2(Side::sell, depth)};
  }
  // getTradeTape (book_ records every accepted/trade/cancel/halt event, not
  // only fills; a caller filters by MarketEventType::trade for fills only)
  [[nodiscard]] const std::vector<tape::MarketEvent> &trade_tape() const noexcept { return book_.events(); }
  // getExpressionTape
  [[nodiscard]] const std::vector<tape::ExpressionEvent> &expression_tape() const noexcept {
    return expression_tape_;
  }
  // getSignalTape: caller-populated (see emit_signal) rather than
  // auto-derived, since deciding what counts as a signal is a
  // scenario/strategy concern this facade does not own.
  void emit_signal(tape::SignalEvent event) { signal_tape_.push_back(std::move(event)); }
  [[nodiscard]] const std::vector<tape::SignalEvent> &signal_tape() const noexcept { return signal_tape_; }
  // getMicrostructureMetrics
  [[nodiscard]] MicrostructureSnapshot microstructure_metrics() const { return microstructure(book_); }
  // getRiskState: evaluates a hypothetical order against `limits`/`account`
  // without submitting it -- a probe, not a stored position (this facade
  // does not track an account on its own; see record_fill/agent_metrics).
  [[nodiscard]] RiskDecision evaluate_risk(const OrderRequest &probe, const AccountState &account,
                                           SourceHealthState health, std::uint64_t recent_messages,
                                           PreTradeLimits limits = {}) const {
    const auto mid = static_cast<PriceTicks>(std::llround(microstructure(book_).midpoint_ticks));
    return PreTradeRisk(limits).check(probe, account, mid, health, recent_messages);
  }
  // getAgentMetrics: net position/fill count of fills the caller has told
  // this handle about via record_fill -- there is no autonomous agent
  // ecology behind this facade (see docs/frontend spec sections on agent
  // ecology, explicitly later-phase work).
  void record_fill(const Fill &fill) {
    net_position_ += fill.aggressor_side == Side::buy ? fill.quantity : -fill.quantity;
    ++fill_count_;
  }
  [[nodiscard]] AgentMetrics agent_metrics() const noexcept { return {net_position_, fill_count_}; }

  [[nodiscard]] LimitOrderBook &book() noexcept { return book_; }
  [[nodiscard]] const LimitOrderBook &book() const noexcept { return book_; }
  [[nodiscard]] expression::BehaviorAccumulator &behavior() noexcept { return behavior_; }
  [[nodiscard]] const expression::BehaviorAccumulator &behavior() const noexcept { return behavior_; }

private:
  LimitOrderBook book_;
  expression::BehaviorAccumulator behavior_;
  std::vector<tape::ExpressionEvent> expression_tape_;
  std::vector<tape::SignalEvent> signal_tape_;
  std::size_t cursor_{};
  ReplayStatus status_{ReplayStatus::idle};
  Quantity net_position_{};
  std::uint64_t fill_count_{};
};

} // namespace cult::exchange
