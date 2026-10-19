#pragma once
#include "components/download/public/common/simple_download_manager.h"
namespace content { class DownloadManager : public download::SimpleDownloadManager { public:
  class Observer { public: virtual void OnDownloadCreated(DownloadManager* manager, download::DownloadItem* item) {} virtual void OnDownloadDropped(DownloadManager*) {} virtual void OnManagerInitialized() {} virtual void ManagerGoingDown(DownloadManager* manager) {} protected: virtual ~Observer() {} };
  virtual void AddObserver(Observer*) = 0; virtual void RemoveObserver(Observer*) = 0; virtual bool IsManagerInitialized() = 0; }; }
