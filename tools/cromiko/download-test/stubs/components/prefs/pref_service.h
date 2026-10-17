#pragma once
#include <string_view>
#include "base/values.h"
class PrefService { public: int GetInteger(std::string_view) const; bool GetBoolean(std::string_view) const; const base::ListValue& GetList(std::string_view) const; };
