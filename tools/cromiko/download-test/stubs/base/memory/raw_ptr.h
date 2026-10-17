#pragma once
#include <cstddef>
namespace base { struct RawPtrTraits {}; }
constexpr int VectorExperimental = 0;
template <typename T, int Traits = 0> class raw_ptr {
 public:
  raw_ptr() = default; raw_ptr(T* p) : p_(p) {} raw_ptr(std::nullptr_t) {}
  raw_ptr& operator=(T* p) { p_ = p; return *this; } raw_ptr& operator=(std::nullptr_t) { p_ = nullptr; return *this; }
  T* operator->() const { return p_; } operator T*() const { return p_; } T* get() const { return p_; }
  explicit operator bool() const { return p_; }
 private: T* p_ = nullptr; };
