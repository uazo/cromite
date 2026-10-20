#pragma once
#include <string_view>
#include "base/values.h"
class PrefService;
class ScopedListPrefUpdate { public: ScopedListPrefUpdate(PrefService* s, std::string_view p); ~ScopedListPrefUpdate(); base::ListValue& Get(); base::ListValue* operator->() { return &Get(); } };
