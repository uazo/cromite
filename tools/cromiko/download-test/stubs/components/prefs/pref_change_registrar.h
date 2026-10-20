#pragma once
#include <map>
#include <string>
#include <string_view>
#include "base/functional/callback.h"
class PrefService;
class PrefChangeRegistrar { public: void Init(PrefService*); void Add(std::string_view path, base::RepeatingClosure obs); };
