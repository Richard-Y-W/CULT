#pragma once
#include <cstddef>
#include <deque>
#include <optional>
#include <span>
#include <vector>

namespace cult::analytics {
class OnlineMoments {
 public:
  void push(double value) noexcept;
  [[nodiscard]] std::size_t count() const noexcept { return count_; }
  [[nodiscard]] double mean() const noexcept { return mean_; }
  [[nodiscard]] double variance() const noexcept;
 private:
  std::size_t count_{}; double mean_{}; double m2_{};
};

class Ewma {
 public:
  explicit Ewma(double alpha);
  double push(double value) noexcept;
  [[nodiscard]] std::optional<double> value() const noexcept { return value_; }
 private:
  double alpha_; std::optional<double> value_;
};

class EwmaMoments {
 public:
  explicit EwmaMoments(double half_life);
  void push(double value) noexcept;
  [[nodiscard]] std::optional<double> mean() const noexcept { return mean_; }
  [[nodiscard]] double variance() const noexcept { return variance_; }
 private:
  double lambda_{};
  std::optional<double> mean_;
  double variance_{};
};

class RollingMoments {
 public:
  explicit RollingMoments(std::size_t capacity);
  void push(double value);
  [[nodiscard]] std::size_t size() const noexcept { return values_.size(); }
  [[nodiscard]] double mean() const noexcept;
  [[nodiscard]] double variance() const noexcept;
  [[nodiscard]] double volatility() const noexcept;
 private:
  std::size_t capacity_; std::deque<double> values_; double sum_{}; double sum_squares_{};
};

class RollingCovariance {
 public:
  explicit RollingCovariance(std::size_t capacity);
  void push(double x, double y);
  [[nodiscard]] double covariance() const noexcept;
  [[nodiscard]] double correlation() const noexcept;
  [[nodiscard]] double beta() const noexcept;
 private:
  std::size_t capacity_; std::deque<std::pair<double,double>> values_; double sx_{},sy_{},sxx_{},syy_{},sxy_{};
};

struct Drawdown { double current{}; double maximum{}; };
struct MarketFactors {
  double market_return{};
  double dispersion{};
  double breadth{};
  double hhi{};
  double effective_expression_count{};
  double normalized_entropy{};
};
[[nodiscard]] std::vector<double> simple_returns(std::span<const double> values);
[[nodiscard]] std::vector<double> log_returns(std::span<const double> values);
[[nodiscard]] double momentum(std::span<const double> values, std::size_t period);
[[nodiscard]] double sample_variance(std::span<const double> values);
[[nodiscard]] double sample_volatility(std::span<const double> values);
[[nodiscard]] double covariance(std::span<const double> lhs, std::span<const double> rhs);
[[nodiscard]] double correlation(std::span<const double> lhs, std::span<const double> rhs);
[[nodiscard]] double beta(std::span<const double> asset, std::span<const double> benchmark);
[[nodiscard]] Drawdown drawdown(std::span<const double> values);
[[nodiscard]] double z_score(double value, std::span<const double> history);
[[nodiscard]] double normalized_entropy(std::span<const double> weights);
[[nodiscard]] double realized_volatility(std::span<const double> returns,double scale=1.0);
[[nodiscard]] double autocorrelation(std::span<const double> values,std::size_t lag);
[[nodiscard]] double robust_z_score(double value,std::span<const double> history);
[[nodiscard]] double spearman_correlation(std::span<const double> lhs,std::span<const double> rhs);
[[nodiscard]] MarketFactors market_factors(std::span<const double> returns,std::span<const double> weights);
}
