#pragma once
namespace base { template <typename T> class [[maybe_unused, nodiscard]] AutoReset { public: AutoReset(T* v, T n) : v_(v), o_(*v) { *v = n; } ~AutoReset() { *v_ = o_; } private: T* v_; T o_; }; }
