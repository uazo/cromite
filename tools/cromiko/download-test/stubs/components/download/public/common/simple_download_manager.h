#pragma once
#include <vector>
#include <string>
#include "base/memory/raw_ptr.h"
#include "components/download/public/common/download_item.h"
namespace download { class SimpleDownloadManager { public:
  using DownloadVector = std::vector<raw_ptr<DownloadItem, VectorExperimental>>;
  virtual void GetAllDownloads(DownloadVector* downloads) = 0; virtual DownloadItem* GetDownloadByGuid(const std::string& guid) = 0; }; }
