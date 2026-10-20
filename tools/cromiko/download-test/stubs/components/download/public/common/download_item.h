#pragma once
#include <cstdint>
#include <string>
#include <vector>
#include "base/supports_user_data.h"
#include "base/time/time.h"
namespace base { class FilePath { public: bool empty() const { return e; } bool e = false; }; }
namespace download {
class DownloadItem : public base::SupportsUserData { public:
  enum DownloadState { IN_PROGRESS = 0, COMPLETE, CANCELLED, INTERRUPTED, MAX_DOWNLOAD_STATE };
  struct ReceivedSlice { int64_t offset; int64_t received_bytes; bool finished; };
  class Observer { public: virtual void OnDownloadUpdated(DownloadItem*) {} virtual void OnDownloadDestroyed(DownloadItem*) {} protected: virtual ~Observer() = default; };
  virtual void AddObserver(Observer*) = 0; virtual void RemoveObserver(Observer*) = 0;
  virtual void Pause() = 0; virtual void Resume(bool user_resume) = 0;
  virtual const std::string& GetGuid() const = 0; virtual DownloadState GetState() const = 0;
  virtual bool IsPaused() const = 0; virtual bool IsTemporary() const = 0; virtual bool CanResume() const = 0; virtual bool IsDone() const = 0;
  virtual const std::string& GetLastModifiedTime() const = 0; virtual const std::string& GetETag() const = 0; virtual bool IsSavePackageDownload() const = 0;
  virtual const base::FilePath& GetTargetFilePath() const = 0; virtual bool IsDangerous() const = 0; virtual bool IsInsecure() const = 0;
  virtual int64_t CurrentSpeed() const = 0; virtual bool AllDataSaved() const = 0;
  virtual const std::vector<ReceivedSlice>& GetReceivedSlices() const = 0; virtual base::Time GetStartTime() const = 0;
  virtual bool IsTransient() const = 0; virtual bool IsParallelDownload() const = 0; };
}
