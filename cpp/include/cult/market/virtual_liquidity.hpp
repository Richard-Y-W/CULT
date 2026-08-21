#pragma once
#include <cstdint>

namespace cult::market {
struct LiquidityParameters { double mean_reversion{0.97}; double impact{0.00002}; double base_volatility{0.005}; double base_half_spread{0.001}; double volatility_spread{0.05}; double quality_spread{0.004}; double liquidity_spread{0.01}; double liquidity{1000.0}; };
struct MarketState { double reference{1000.0}; double log_premium{}; double reference_volatility{}; double data_quality{1.0}; };
struct Quote { double bid{}; double ask{}; double mid{}; double half_spread{}; };
class VirtualLiquidityProvider {
 public:
  explicit VirtualLiquidityProvider(LiquidityParameters parameters={}):parameters_(parameters){}
  [[nodiscard]] Quote quote(const MarketState& state) const;
  [[nodiscard]] MarketState advance(const MarketState& state,double signed_order_flow,double innovation) const;
 private: LiquidityParameters parameters_;
};
struct RiskLimits { double initial_margin{0.50}; double maintenance_margin{0.30}; double maximum_gross_leverage{2.0}; double maximum_net_leverage{1.25}; double concentration_limit{0.60}; };
struct RiskSnapshot { double equity{}; double gross_exposure{}; double net_exposure{}; double largest_position{}; };
enum class RiskStatus : std::uint8_t { normal, margin_call, liquidation, bankrupt };
[[nodiscard]] RiskStatus assess_risk(const RiskSnapshot& snapshot,const RiskLimits& limits);
}
