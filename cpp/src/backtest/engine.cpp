#include "cult/backtest/engine.hpp"
#include "cult/analytics/streaming.hpp"
#include <algorithm>
#include <cmath>
#include <numeric>
#include <stdexcept>

namespace cult::backtest {
double DataView::price(std::size_t bars_ago, std::size_t asset) const {
  if (asset >= assets_ || bars_ago > current_index_) throw std::out_of_range("DataView request exceeds information horizon");
  return prices_[(current_index_ - bars_ago) * assets_ + asset];
}

std::vector<Target> CrossSectionalMomentum::on_bar(const DataView& view) {
  if (view.bars() <= lookback_ || count_ == 0) return {};
  std::vector<std::pair<double, std::size_t>> ranks;
  for (std::size_t asset = 0; asset < view.assets(); ++asset) {
    const double prior = view.price(lookback_, asset), now = view.price(0, asset);
    if (prior > 0.0 && now > 0.0) ranks.emplace_back(now / prior - 1.0, asset);
  }
  std::sort(ranks.begin(), ranks.end(), std::greater<>());
  ranks.resize(std::min(count_, ranks.size()));
  std::vector<Target> targets;
  for (const auto& [rank, asset] : ranks) {
    (void)rank;
    targets.push_back({asset, 1.0 / static_cast<double>(ranks.size())});
  }
  return targets;
}

Result run(std::span<const TimestampMs> timestamps, std::span<const double> prices, std::size_t asset_count,
           Strategy& strategy, const Config& config) {
  if (timestamps.empty() || asset_count == 0 || prices.size() != timestamps.size() * asset_count)
    throw std::invalid_argument("backtest data dimensions invalid");
  double cash = config.initial_cash, turnover = 0.0;
  std::size_t trades = 0, winning = 0, holding_sum = 0;
  std::vector<double> quantity(asset_count), entry(asset_count), held(asset_count);
  Result result;
  result.equity_curve.reserve(timestamps.size());
  for (std::size_t bar = 0; bar < timestamps.size(); ++bar) {
    double equity = cash;
    for (std::size_t asset = 0; asset < asset_count; ++asset) equity += quantity[asset] * prices[bar * asset_count + asset];
    if (bar % config.rebalance_every == 0) {
      const DataView view(timestamps, prices, asset_count, bar);
      const auto requested = strategy.on_bar(view);
      std::vector<double> weights(asset_count);
      for (const auto& target : requested) if (target.asset < asset_count) weights[target.asset] = target.weight;
      double gross_weight = 0.0;
      for (double weight : weights) gross_weight += std::abs(weight);
      const double scale = gross_weight > config.maximum_gross_leverage ? config.maximum_gross_leverage / gross_weight : 1.0;
      for (std::size_t asset = 0; asset < asset_count; ++asset) {
        const double price = prices[bar * asset_count + asset];
        if (price <= 0.0) continue;
        const double desired = equity * weights[asset] * scale / price;
        const double delta = desired - quantity[asset], notional = std::abs(delta * price);
        if (notional < 1e-9) continue;
        const double execution = price * (1.0 + (delta > 0.0 ? config.slippage_rate : -config.slippage_rate));
        const double fee = notional * config.fee_rate;
        if (quantity[asset] != 0.0 && std::signbit(quantity[asset]) != std::signbit(desired) &&
            quantity[asset] * (execution - entry[asset]) > 0.0) ++winning;
        cash -= delta * execution + fee;
        turnover += notional;
        ++trades;
        if (desired == 0.0) {
          holding_sum += static_cast<std::size_t>(held[asset]); held[asset] = 0.0; entry[asset] = 0.0;
        } else if (quantity[asset] == 0.0 || std::signbit(quantity[asset]) != std::signbit(desired)) entry[asset] = execution;
        quantity[asset] = desired;
      }
    }
    for (std::size_t asset = 0; asset < asset_count; ++asset) {
      if (quantity[asset] != 0.0) held[asset] += 1.0;
      if (quantity[asset] < 0.0) cash -= std::abs(quantity[asset] * prices[bar * asset_count + asset]) * config.annual_borrow_rate / 365.0;
    }
    equity = cash;
    for (std::size_t asset = 0; asset < asset_count; ++asset) equity += quantity[asset] * prices[bar * asset_count + asset];
    result.equity_curve.push_back(equity);
  }
  const auto returns = analytics::simple_returns(result.equity_curve);
  const auto drawdown = analytics::drawdown(result.equity_curve);
  double negative_squares = 0.0;
  std::size_t negatives = 0;
  for (double value : returns) if (value < 0.0) { negative_squares += value * value; ++negatives; }
  const double mean = returns.empty() ? 0.0 : std::accumulate(returns.begin(), returns.end(), 0.0) / static_cast<double>(returns.size());
  const double volatility = analytics::sample_volatility(returns);
  const double downside = negatives ? std::sqrt(negative_squares / static_cast<double>(negatives)) : 0.0;
  double gross = 0.0, net = 0.0;
  for (std::size_t asset = 0; asset < asset_count; ++asset) {
    const double value = quantity[asset] * prices[(timestamps.size() - 1) * asset_count + asset];
    gross += std::abs(value); net += value;
  }
  result.total_return = result.equity_curve.back() / config.initial_cash - 1.0;
  result.annualized_volatility = volatility * std::sqrt(365.0);
  result.sharpe_like = volatility > 0.0 ? mean / volatility * std::sqrt(365.0) : 0.0;
  result.sortino = downside > 0.0 ? mean / downside * std::sqrt(365.0) : 0.0;
  result.maximum_drawdown = drawdown.maximum;
  result.turnover = turnover / config.initial_cash;
  result.gross_exposure = gross;
  result.net_exposure = net;
  result.hit_rate = trades ? static_cast<double>(winning) / static_cast<double>(trades) : 0.0;
  result.trade_count = trades;
  result.average_holding_period = trades ? static_cast<double>(holding_sum) / static_cast<double>(trades) : 0.0;
  return result;
}
}
