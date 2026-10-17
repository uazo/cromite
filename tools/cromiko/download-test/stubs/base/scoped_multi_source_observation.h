#pragma once
#include <algorithm>
#include <vector>
namespace base { template <class Source, class Observer> class ScopedMultiSourceObservation { public:
  explicit ScopedMultiSourceObservation(Observer* o) : o_(o) {} ~ScopedMultiSourceObservation() { RemoveAllObservations(); }
  void AddObservation(Source* s) { if (IsObservingSource(s)) throw 1; s_.push_back(s); s->AddObserver(o_); }
  void RemoveObservation(Source* s) { auto it = std::find(s_.begin(), s_.end(), s); if (it == s_.end()) throw 2; s_.erase(it); s->RemoveObserver(o_); }
  void RemoveAllObservations() { for (auto* s : s_) s->RemoveObserver(o_); s_.clear(); }
  bool IsObservingSource(Source* s) const { return std::find(s_.begin(), s_.end(), s) != s_.end(); }
 private: Observer* o_; std::vector<Source*> s_; }; }
