#pragma once
#include <algorithm>
#include <string>
#include <string_view>
#include <vector>
#include <cstddef>
namespace base {
class Value { public: explicit Value(std::string s) : s_(std::move(s)) {} explicit Value(const char* s) : s_(s) {} bool is_string() const { return true; } const std::string& GetString() const { return s_; }
  bool operator==(const Value& o) const { return s_ == o.s_; } private: std::string s_; };
class ListValue { public:
  bool contains(std::string_view v) const { return std::find(items_.begin(), items_.end(), Value(std::string(v))) != items_.end(); }
  void Append(std::string_view v) & { items_.emplace_back(std::string(v)); }
  size_t EraseValue(const Value& v) { size_t n = items_.size(); std::erase(items_, v); return n - items_.size(); }
  template <typename P> size_t EraseIf(P p) { return std::erase_if(items_, p); }
  const Value* begin() const { return items_.data(); } const Value* end() const { return items_.data() + items_.size(); }
  size_t size() const { return items_.size(); }
 private: std::vector<Value> items_; };
}
