#include "cult/expression/registry.hpp"
#include <algorithm>
#include <map>
#include <stdexcept>

namespace cult::expression {
EmojiRegistry::EmojiRegistry(std::vector<RegistryEntry> entries):entries_(std::move(entries)){for(const auto& e:entries_)if(e.sequences_utf8.empty())throw std::invalid_argument("registry entry requires a sequence");}
std::vector<MatchResult> EmojiRegistry::extract(std::string_view text)const{struct Candidate{ExpressionId id;const RegistryEntry* entry;std::string_view raw;};std::map<ExpressionId,MatchResult> matches;std::size_t offset=0;while(offset<text.size()){std::optional<Candidate> best;for(const auto& entry:entries_)for(const auto& sequence:entry.sequences_utf8)if(sequence.size()<=text.size()-offset&&text.substr(offset,sequence.size())==sequence&&(!best||sequence.size()>best->raw.size()))best=Candidate{entry.id,&entry,sequence};if(best){auto& result=matches[best->id];result.expression_id=best->id;result.stable_id=best->entry->stable_id;++result.occurrences;result.raw_forms.emplace_back(best->raw);offset+=best->raw.size();}else{const unsigned char lead=static_cast<unsigned char>(text[offset]);std::size_t advance=1;if((lead&0xE0U)==0xC0U)advance=2;else if((lead&0xF0U)==0xE0U)advance=3;else if((lead&0xF8U)==0xF0U)advance=4;offset+=std::min(advance,text.size()-offset);}}std::vector<MatchResult> out;out.reserve(matches.size());for(auto& [id,result]:matches){(void)id;out.push_back(std::move(result));}return out;}
}
