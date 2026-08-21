#include "cult/analytics/streaming.hpp"
#include <algorithm>
#include <cmath>
#include <numeric>
#include <stdexcept>

namespace cult::analytics {
void OnlineMoments::push(double value) noexcept { ++count_; const double delta=value-mean_; mean_+=delta/static_cast<double>(count_); m2_+=delta*(value-mean_); }
double OnlineMoments::variance() const noexcept { return count_>1?m2_/static_cast<double>(count_-1):0.0; }
Ewma::Ewma(double alpha):alpha_(alpha){if(!(alpha>0.0&&alpha<=1.0))throw std::invalid_argument("EWMA alpha must be in (0,1]");}
double Ewma::push(double value) noexcept { value_=value_?alpha_*value+(1.0-alpha_)*value_.value():value;return value_.value(); }
RollingMoments::RollingMoments(std::size_t capacity):capacity_(capacity){if(capacity==0)throw std::invalid_argument("rolling capacity must be positive");}
void RollingMoments::push(double value){values_.push_back(value);sum_+=value;sum_squares_+=value*value;if(values_.size()>capacity_){const double old=values_.front();values_.pop_front();sum_-=old;sum_squares_-=old*old;}}
double RollingMoments::mean()const noexcept{return values_.empty()?0.0:sum_/static_cast<double>(values_.size());}
double RollingMoments::variance()const noexcept{if(values_.size()<2)return 0.0;const double n=static_cast<double>(values_.size());return std::max(0.0,(sum_squares_-sum_*sum_/n)/(n-1.0));}
double RollingMoments::volatility()const noexcept{return std::sqrt(variance());}
RollingCovariance::RollingCovariance(std::size_t capacity):capacity_(capacity){if(capacity==0)throw std::invalid_argument("rolling capacity must be positive");}
void RollingCovariance::push(double x,double y){values_.emplace_back(x,y);sx_+=x;sy_+=y;sxx_+=x*x;syy_+=y*y;sxy_+=x*y;if(values_.size()>capacity_){const auto [ox,oy]=values_.front();values_.pop_front();sx_-=ox;sy_-=oy;sxx_-=ox*ox;syy_-=oy*oy;sxy_-=ox*oy;}}
double RollingCovariance::covariance()const noexcept{const double n=static_cast<double>(values_.size());return n<2.0?0.0:(sxy_-sx_*sy_/n)/(n-1.0);}
double RollingCovariance::correlation()const noexcept{const double n=static_cast<double>(values_.size());if(n<2.0)return 0.0;const double vx=(sxx_-sx_*sx_/n)/(n-1.0),vy=(syy_-sy_*sy_/n)/(n-1.0),den=std::sqrt(std::max(0.0,vx*vy));return den>0.0?covariance()/den:0.0;}
double RollingCovariance::beta()const noexcept{const double n=static_cast<double>(values_.size());if(n<2.0)return 0.0;const double vy=(syy_-sy_*sy_/n)/(n-1.0);return vy>0.0?covariance()/vy:0.0;}
std::vector<double> simple_returns(std::span<const double> v){std::vector<double> out;out.reserve(v.size()>0?v.size()-1:0);for(std::size_t i=1;i<v.size();++i)out.push_back(v[i]/v[i-1]-1.0);return out;}
std::vector<double> log_returns(std::span<const double> v){std::vector<double> out;out.reserve(v.size()>0?v.size()-1:0);for(std::size_t i=1;i<v.size();++i){if(v[i]<=0.0||v[i-1]<=0.0)throw std::domain_error("log returns require positive values");out.push_back(std::log(v[i]/v[i-1]));}return out;}
double momentum(std::span<const double> v,std::size_t p){return v.size()<=p?0.0:v.back()/v[v.size()-p-1]-1.0;}
double sample_variance(std::span<const double> v){if(v.size()<2)return 0.0;OnlineMoments m;for(double x:v)m.push(x);return m.variance();}
double sample_volatility(std::span<const double> v){return std::sqrt(sample_variance(v));}
double covariance(std::span<const double>a,std::span<const double>b){const auto n=std::min(a.size(),b.size());if(n<2)return 0.0;OnlineMoments ma,mb;for(std::size_t i=0;i<n;++i){ma.push(a[a.size()-n+i]);mb.push(b[b.size()-n+i]);}double sum=0.0;for(std::size_t i=0;i<n;++i)sum+=(a[a.size()-n+i]-ma.mean())*(b[b.size()-n+i]-mb.mean());return sum/static_cast<double>(n-1);}
double correlation(std::span<const double>a,std::span<const double>b){const auto n=std::min(a.size(),b.size());if(n<2)return 0.0;const auto aa=a.last(n),bb=b.last(n);const double den=sample_volatility(aa)*sample_volatility(bb);return den>0.0?covariance(aa,bb)/den:0.0;}
double beta(std::span<const double>a,std::span<const double>b){const auto n=std::min(a.size(),b.size());if(n<2)return 0.0;const auto bb=b.last(n);const double var=sample_variance(bb);return var>0.0?covariance(a.last(n),bb)/var:0.0;}
Drawdown drawdown(std::span<const double> v){double peak=0.0,current=0.0,maximum=0.0;for(double x:v){peak=std::max(peak,x);current=peak>0.0?x/peak-1.0:0.0;maximum=std::min(maximum,current);}return{current,maximum};}
double z_score(double value,std::span<const double> h){if(h.empty())return 0.0;OnlineMoments m;for(double x:h)m.push(x);const double sd=std::sqrt(m.variance());return sd>0.0?(value-m.mean())/sd:0.0;}
double normalized_entropy(std::span<const double> weights){if(weights.empty())return 0.0;double sum=0.0;std::size_t positive=0;for(double w:weights){if(!std::isfinite(w)||w<0.0)throw std::invalid_argument("entropy weights must be finite and nonnegative");if(w>0.0){sum+=w;++positive;}}if(sum<=0.0||positive<2)return 0.0;double h=0.0;for(double w:weights)if(w>0.0){const double p=w/sum;h-=p*std::log(p);}return h/std::log(static_cast<double>(positive));}
}
