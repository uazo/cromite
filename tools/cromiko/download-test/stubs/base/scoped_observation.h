#pragma once
namespace base { template <class Source, class Observer> class ScopedObservation { public:
  explicit ScopedObservation(Observer* o) : o_(o) {} ~ScopedObservation() { Reset(); }
  void Observe(Source* s) { s_ = s; s->AddObserver(o_); } void Reset() { if (s_) s_->RemoveObserver(o_); s_ = nullptr; }
 private: Observer* o_; Source* s_ = nullptr; }; }
