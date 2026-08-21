#include <pybind11/pybind11.h>
#include <pybind11/stl.h>

#include "cult/analytics/streaming.hpp"
#include "cult/expression/metrics.hpp"

namespace py = pybind11;

PYBIND11_MODULE(_cult_quant, module) {
  module.doc() = "CULT production quantitative primitives for research";
  module.def("simple_returns", &cult::analytics::simple_returns);
  module.def("log_returns", &cult::analytics::log_returns);
  module.def("sample_volatility", &cult::analytics::sample_volatility);
  module.def("correlation", &cult::analytics::correlation);
  module.def("beta", &cult::analytics::beta);
  module.def("normalized_entropy", &cult::analytics::normalized_entropy);
  module.def("jeffreys_prevalence_per_million",
             [](std::uint64_t expression_documents, std::uint64_t eligible_documents) {
               return cult::expression::prevalence(expression_documents, eligible_documents)
                   .smoothed_per_million;
             });
}
