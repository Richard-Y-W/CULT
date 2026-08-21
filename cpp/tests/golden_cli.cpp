#include "cult/analytics/streaming.hpp"
#include "cult/expression/metrics.hpp"
#include "cult/index/reference_index.hpp"
#include <cmath>
#include <iomanip>
#include <iostream>
#include <vector>
int main(){using namespace cult;std::cout<<std::setprecision(17);const std::vector<double> values{100,110,121,115,130},a{.1,.2,-.1,.3},b{.2,.4,-.2,.6},entropy{.34,.25,.18,.10,.08,.05};const auto p=expression::prevalence(10,1000);const std::vector<double> pr{.1,-.05,.02},pw{.5,.3,.2},recent{.1,.2,-.1};const auto s=expression::signals(pr,pw,recent,.03);index::ReferencePoint base;std::cout<<"momentum="<<analytics::momentum(values,3)<<'\n'<<"volatility="<<analytics::sample_volatility(a)<<'\n'<<"covariance="<<analytics::covariance(a,b)<<'\n'<<"correlation="<<analytics::correlation(a,b)<<'\n'<<"beta="<<analytics::beta(a,b)<<'\n'<<"drawdown="<<analytics::drawdown(values).maximum<<'\n'<<"zscore="<<analytics::z_score(130,values)<<'\n'<<"entropy="<<analytics::normalized_entropy(entropy)<<'\n'<<"raw_prevalence="<<p.raw_per_million<<'\n'<<"smoothed_probability="<<p.smoothed_probability<<'\n'<<"velocity="<<s.velocity<<'\n'<<"acceleration="<<s.acceleration<<'\n'<<"breadth="<<s.breadth<<'\n'<<"signed_breadth="<<s.signed_breadth<<'\n'<<"persistence="<<s.persistence<<'\n'<<"reference="<<index::chain_link(base,std::log(1.08)).value<<'\n';}
