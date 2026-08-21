#include "cult/index/reference_index.hpp"
#include <algorithm>
#include <cmath>
#include <numeric>
#include <stdexcept>

namespace cult::index {
double weighted_platform_return(std::span<const double> returns,std::span<const double> weights){if(returns.size()!=weights.size()||returns.empty())throw std::invalid_argument("returns and weights must align");double sum=0.0,total=0.0;for(std::size_t i=0;i<returns.size();++i){if(weights[i]<0.0)throw std::invalid_argument("negative platform weight");sum+=returns[i]*weights[i];total+=weights[i];}if(total<=0.0)throw std::invalid_argument("weights must sum positive");return sum/total;}
ReferencePoint chain_link(const ReferencePoint& previous,double aggregate_return,bool is_final){return{previous.value*std::exp(aggregate_return),aggregate_return,is_final?IndexStatus::official:IndexStatus::provisional,is_final,0,kReferenceMethodologyVersion};}
std::optional<double> data_quality_score(const QualityComponents& c){struct Component{std::optional<double> value;double weight;};const Component parts[]={{c.sample_adequacy,.30},{c.source_coverage,.20},{c.source_health,.20},{c.cross_source_agreement,.10},{c.author_concentration,.15},{c.missingness,.05}};double score=0.0,weight=0.0;for(const auto& p:parts)if(p.value){score+=std::clamp(p.value.value(),0.0,1.0)*p.weight;weight+=p.weight;}if(weight<.5)return std::nullopt;return 100.0*score/weight;}
}
