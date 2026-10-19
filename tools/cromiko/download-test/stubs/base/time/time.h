#pragma once
namespace base { class Time { public: int t = 0; bool operator<(const Time& o) const { return t < o.t; } }; }
