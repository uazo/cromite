#pragma once
#include <string_view>
namespace user_prefs { class PrefRegistrySyncable { public: void RegisterIntegerPref(std::string_view, int, unsigned flags = 0); void RegisterBooleanPref(std::string_view, bool, unsigned flags = 0); void RegisterListPref(std::string_view, unsigned flags = 0); }; }
