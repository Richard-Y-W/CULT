#include <node_api.h>

#include <cstddef>
#include <stdexcept>
#include <string>
#include <vector>

#include "cult/analytics/streaming.hpp"

namespace {
void check(napi_env env, napi_status status, const char* operation) {
  if (status == napi_ok) return;
  napi_throw_error(env, nullptr, operation);
  throw std::runtime_error(operation);
}

std::vector<double> read_series(napi_env env, napi_value input) {
  bool is_array = false;
  check(env, napi_is_array(env, input, &is_array), "Unable to inspect analytics series");
  if (!is_array) throw std::invalid_argument("series must be an array");
  std::uint32_t size = 0;
  check(env, napi_get_array_length(env, input, &size), "Unable to read analytics series");
  std::vector<double> values;
  values.reserve(size);
  for (std::uint32_t index = 0; index < size; ++index) {
    napi_value item;
    double value = 0.0;
    check(env, napi_get_element(env, input, index, &item), "Unable to read series element");
    check(env, napi_get_value_double(env, item, &value), "Series elements must be numbers");
    values.push_back(value);
  }
  return values;
}

void set_number(napi_env env, napi_value object, const char* name, double number) {
  napi_value value;
  check(env, napi_create_double(env, number, &value), "Unable to create result number");
  check(env, napi_set_named_property(env, object, name, value), "Unable to set result property");
}

napi_value compute_rolling_analytics(napi_env env, napi_callback_info info) {
  try {
    std::size_t argc = 1;
    napi_value args[1];
    check(env, napi_get_cb_info(env, info, &argc, args, nullptr, nullptr), "Unable to read arguments");
    if (argc != 1) throw std::invalid_argument("computeRollingAnalytics requires one series");
    const auto values = read_series(env, args[0]);
    const auto returns = cult::analytics::simple_returns(values);
    const auto dd = cult::analytics::drawdown(values);
    napi_value result;
    check(env, napi_create_object(env, &result), "Unable to create analytics result");
    set_number(env, result, "volatility", cult::analytics::sample_volatility(returns));
    set_number(env, result, "currentDrawdown", dd.current);
    set_number(env, result, "maximumDrawdown", dd.maximum);
    set_number(env, result, "zScore", values.empty() ? 0.0 : cult::analytics::z_score(values.back(), values));
    return result;
  } catch (const std::exception& error) {
    napi_throw_type_error(env, nullptr, error.what());
    return nullptr;
  }
}

napi_value initialize(napi_env env, napi_value exports) {
  napi_value function;
  check(env, napi_create_function(env, "computeRollingAnalytics", NAPI_AUTO_LENGTH,
                                  compute_rolling_analytics, nullptr, &function),
        "Unable to create Node-API function");
  check(env, napi_set_named_property(env, exports, "computeRollingAnalytics", function),
        "Unable to export Node-API function");
  return exports;
}
}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, initialize)
