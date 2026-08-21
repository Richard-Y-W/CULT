#pragma once
#include "cult/core/types.hpp"
#include <cstddef>
#include <span>
#include <vector>

namespace cult::backtest {
struct Bar { TimestampMs timestamp_ms{}; std::span<const double> prices; };
class DataView {
 public:
  DataView(std::span<const TimestampMs> timestamps,std::span<const double> prices,std::size_t assets,std::size_t current_index):timestamps_(timestamps),prices_(prices),assets_(assets),current_index_(current_index){}
  [[nodiscard]] std::size_t bars()const noexcept{return current_index_+1;}
  [[nodiscard]] std::size_t assets()const noexcept{return assets_;}
  [[nodiscard]] double price(std::size_t bars_ago,std::size_t asset)const;
  [[nodiscard]] TimestampMs now()const{return timestamps_[current_index_];}
 private:std::span<const TimestampMs> timestamps_;std::span<const double> prices_;std::size_t assets_;std::size_t current_index_;
};
struct Target { std::size_t asset{}; double weight{}; };
class Strategy { public: virtual ~Strategy()=default; virtual std::vector<Target> on_bar(const DataView& view)=0; };
class CrossSectionalMomentum final:public Strategy { public:CrossSectionalMomentum(std::size_t lookback,std::size_t count):lookback_(lookback),count_(count){}std::vector<Target>on_bar(const DataView&view)override;private:std::size_t lookback_,count_;};
struct Config {
  double initial_cash{10'000.0};
  double commission_rate{.001};
  double half_spread_rate{.0005};
  double impact_coefficient{.001};
  double virtual_liquidity{100'000.0};
  double annual_borrow_rate{.03};
  double annual_funding_rate{0.0};
  double periods_per_year{365.0};
  std::size_t rebalance_every{7};
  std::size_t execution_delay_bars{1};
  double maximum_gross_leverage{2.0};
};
struct Result {
  double total_return{};
  double annualized_volatility{};
  double sharpe_like{};
  double sortino{};
  double maximum_drawdown{};
  double drawdown_duration{};
  double value_at_risk_95{};
  double expected_shortfall_95{};
  double turnover{};
  double gross_exposure{};
  double net_exposure{};
  double commission_cost{};
  double spread_cost{};
  double impact_cost{};
  double borrow_cost{};
  double funding_cost{};
  double hit_rate{};
  std::size_t trade_count{};
  double average_holding_period{};
  std::vector<double> equity_curve;
};
[[nodiscard]] Result run(std::span<const TimestampMs> timestamps,std::span<const double> prices,std::size_t asset_count,Strategy& strategy,const Config& config={});
}
