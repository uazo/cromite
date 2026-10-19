#pragma once
#include <memory>
namespace base { class SupportsUserData { public:
  class Data { public: virtual ~Data() = default; };
  virtual ~SupportsUserData() = default;
  Data* GetUserData(const void* key) const; void SetUserData(const void* key, std::unique_ptr<Data> data); void RemoveUserData(const void* key); }; }
