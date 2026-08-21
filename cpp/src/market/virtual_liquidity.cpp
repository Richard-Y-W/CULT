#include "cult/market/virtual_liquidity.hpp"
#include <algorithm>
#include <cmath>
#include <stdexcept>

namespace cult::market {
Quote VirtualLiquidityProvider::quote(const MarketState& s)const{if(s.reference<=0.0||parameters_.liquidity<=0.0)throw std::invalid_argument("reference and liquidity must be positive");const double mid=s.reference*std::exp(s.log_premium),quality=std::clamp(s.data_quality,0.0,1.0),half=parameters_.base_half_spread+parameters_.volatility_spread*std::max(0.0,s.reference_volatility)+parameters_.quality_spread*(1.0-quality)+parameters_.liquidity_spread/std::sqrt(parameters_.liquidity);return{mid*std::exp(-half),mid*std::exp(half),mid,half};}
MarketState VirtualLiquidityProvider::advance(const MarketState&s,double flow,double innovation)const{MarketState next=s;const double sigma=parameters_.base_volatility*(1.0+.5*std::max(0.0,s.reference_volatility)+.5*(1.0-std::clamp(s.data_quality,0.0,1.0)));next.log_premium=parameters_.mean_reversion*s.log_premium+parameters_.impact*flow+sigma*innovation;return next;}
RiskStatus assess_risk(const RiskSnapshot&s,const RiskLimits&l){if(s.equity<=0.0)return RiskStatus::bankrupt;const double gross=s.gross_exposure/s.equity,net=std::abs(s.net_exposure)/s.equity,concentration=s.largest_position/s.equity,maintenance=s.gross_exposure*l.maintenance_margin;if(s.equity<maintenance*.65)return RiskStatus::liquidation;if(s.equity<maintenance||gross>l.maximum_gross_leverage||net>l.maximum_net_leverage||concentration>l.concentration_limit)return RiskStatus::margin_call;return RiskStatus::normal;}
}
