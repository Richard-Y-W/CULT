#pragma once

#include "cult/core/types.hpp"
#include "cult/tape/events.hpp"
#include <cstdint>
#include <functional>
#include <list>
#include <map>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace cult::exchange {
using PriceTicks = std::int64_t;
using Quantity = std::int64_t;
using OrderId = std::uint64_t;
using AgentId = std::uint64_t;

enum class Side : std::uint8_t { buy, sell };
enum class OrderType : std::uint8_t { limit, market };
enum class TimeInForce : std::uint8_t { good_til_cancel, immediate_or_cancel, fill_or_kill };
enum class StpMode : std::uint8_t { cancel_newest, cancel_oldest, cancel_both };
enum class RejectReason : std::uint8_t {
  none,
  invalid_quantity,
  invalid_price,
  duplicate_order,
  post_only_would_trade,
  fok_unfilled,
  market_closed,
  self_trade,
  risk_rejected,
  unknown_order
};
enum class InstrumentState : std::uint8_t { preopen, open, halted, auction, closed };

struct InstrumentConfig {
  ExpressionId expression_id{};
  PriceTicks tick_size{1};
  Quantity lot_size{1};
  Quantity minimum_order_size{1};
  StpMode stp_mode{StpMode::cancel_newest};
};
struct OrderRequest {
  OrderId order_id{};
  AgentId agent_id{};
  Side side{Side::buy};
  OrderType type{OrderType::limit};
  TimeInForce time_in_force{TimeInForce::good_til_cancel};
  PriceTicks price_ticks{};
  Quantity quantity{};
  bool post_only{};
  tape::TimestampNs send_time_ns{};
};
struct RestingOrder {
  OrderId order_id{};
  AgentId agent_id{};
  Side side{Side::buy};
  PriceTicks price_ticks{};
  Quantity original_quantity{};
  Quantity remaining_quantity{};
  std::uint64_t accepted_sequence{};
  tape::TimestampNs accepted_time_ns{};
};
struct Fill {
  std::uint64_t trade_sequence{};
  OrderId maker_order_id{};
  OrderId taker_order_id{};
  AgentId maker_agent_id{};
  AgentId taker_agent_id{};
  PriceTicks price_ticks{};
  Quantity quantity{};
  Side aggressor_side{Side::buy};
  tape::TimestampNs exchange_time_ns{};
};
struct OrderResult {
  bool accepted{};
  RejectReason reject_reason{RejectReason::none};
  Quantity filled_quantity{};
  Quantity resting_quantity{};
  std::vector<Fill> fills;
};
struct Level {
  PriceTicks price_ticks{};
  Quantity quantity{};
  std::size_t order_count{};
};
struct L1Snapshot {
  std::optional<Level> bid;
  std::optional<Level> ask;
  std::uint64_t sequence{};
};
struct QueuePosition {
  Quantity quantity_ahead{};
  Quantity quantity_behind{};
  std::size_t rank{};
  tape::TimestampNs accepted_time_ns{};
};
struct BookStateSnapshot {
  InstrumentState state{InstrumentState::open};
  std::uint64_t sequence{};
  tape::TimestampNs last_event_time_ns{};
  std::vector<RestingOrder> bids;
  std::vector<RestingOrder> asks;
  std::vector<tape::MarketEvent> events;
};

class LimitOrderBook {
public:
  explicit LimitOrderBook(InstrumentConfig config);
  [[nodiscard]] OrderResult submit(const OrderRequest &request, tape::TimestampNs exchange_time_ns);
  [[nodiscard]] bool cancel(OrderId order_id, AgentId agent_id, tape::TimestampNs exchange_time_ns);
  [[nodiscard]] OrderResult replace(OrderId order_id, AgentId agent_id, PriceTicks new_price, Quantity new_quantity,
                                    tape::TimestampNs exchange_time_ns);
  [[nodiscard]] L1Snapshot l1() const;
  [[nodiscard]] std::vector<Level> l2(Side side, std::size_t depth) const;
  [[nodiscard]] std::vector<RestingOrder> l3(Side side, std::size_t depth) const;
  [[nodiscard]] std::optional<QueuePosition> queue_position(OrderId order_id) const;
  [[nodiscard]] std::optional<RestingOrder> order(OrderId order_id) const;
  [[nodiscard]] const std::vector<tape::MarketEvent> &events() const noexcept { return events_; }
  [[nodiscard]] std::uint64_t sequence() const noexcept { return sequence_; }
  [[nodiscard]] InstrumentState state() const noexcept { return state_; }
  void set_state(InstrumentState state, tape::TimestampNs exchange_time_ns);
  [[nodiscard]] bool invariant_holds() const;
  [[nodiscard]] BookStateSnapshot snapshot_state() const;
  void restore_state(const BookStateSnapshot &snapshot);

private:
  using OrderList = std::list<RestingOrder>;
  using BidLevels = std::map<PriceTicks, OrderList, std::greater<PriceTicks>>;
  using AskLevels = std::map<PriceTicks, OrderList>;
  struct Locator {
    Side side;
    PriceTicks price_ticks;
    OrderList::iterator iterator;
  };
  InstrumentConfig config_;
  InstrumentState state_{InstrumentState::open};
  BidLevels bids_;
  AskLevels asks_;
  std::unordered_map<OrderId, Locator> locators_;
  std::vector<tape::MarketEvent> events_;
  std::uint64_t sequence_{};
  tape::TimestampNs last_event_time_ns_{};
  [[nodiscard]] bool marketable(const OrderRequest &request) const;
  [[nodiscard]] Quantity available(const OrderRequest &request) const;
  void rest(const OrderRequest &request, Quantity remaining, tape::TimestampNs exchange_time_ns);
  void erase(const Locator &locator);
  void emit(tape::MarketEventType type, tape::TimestampNs time, OrderId order_id, OrderId contra, PriceTicks price,
            Quantity quantity, bool buy_aggressor, std::string reason = {});
};
} // namespace cult::exchange
