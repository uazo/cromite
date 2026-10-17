#pragma once
#include <functional>
namespace base {
template <typename Sig> class RepeatingCallback;
template <typename R, typename... A> class RepeatingCallback<R(A...)> {
 public:
  RepeatingCallback() = default;
  explicit RepeatingCallback(std::function<R(A...)> f) : f_(std::move(f)) {}
  R Run(A... a) const { return f_(a...); }
 private:
  std::function<R(A...)> f_;
};
using RepeatingClosure = RepeatingCallback<void()>;
}
