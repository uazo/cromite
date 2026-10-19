#pragma once
#include "base/functional/callback.h"
namespace base {
template <typename T> T* Unretained(T* t) { return t; }
template <typename R, typename C, typename... A> RepeatingCallback<R(A...)> BindRepeating(R (C::*m)(A...), C* c) {
  return RepeatingCallback<R(A...)>([m, c](A... a) { return (c->*m)(a...); });
}
}
