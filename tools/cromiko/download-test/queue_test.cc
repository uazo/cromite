// Tests CromikoDownloadQueue with fake downloads, see run.sh.
#include <cstdio>
#include <map>
#include <memory>
#include <string>
#include <vector>

#include "chrome/browser/download/cromiko_download_queue.h"
#include "components/download/public/common/parallel_download_configs.h"
#include "components/pref_registry/pref_registry_syncable.h"
#include "components/prefs/pref_change_registrar.h"
#include "components/prefs/pref_service.h"
#include "components/prefs/scoped_user_pref_update.h"

using download::DownloadItem;
using Reason = CromikoDownloadQueue::WaitReason;

// ---- Stand-in implementations.
namespace {
std::map<const base::SupportsUserData*,
         std::map<const void*, std::unique_ptr<base::SupportsUserData::Data>>>
    g_user_data;
std::map<std::string, int> g_ints;
std::map<std::string, bool> g_bools;
std::map<std::string, base::ListValue> g_lists;
std::map<std::string, base::RepeatingClosure> g_pref_observers;
net::NetworkChangeNotifier::ConnectionType g_type =
    net::NetworkChangeNotifier::CONNECTION_WIFI;
net::NetworkChangeNotifier::ConnectionCost g_cost =
    net::NetworkChangeNotifier::CONNECTION_COST_UNMETERED;
std::vector<net::NetworkChangeNotifier::NetworkChangeObserver*> g_net_observers;
int g_connections_override = -1;
}  // namespace

base::SupportsUserData::Data* base::SupportsUserData::GetUserData(
    const void* key) const {
  auto& m = g_user_data[this];
  auto it = m.find(key);
  return it == m.end() ? nullptr : it->second.get();
}
void base::SupportsUserData::SetUserData(const void* key,
                                         std::unique_ptr<Data> data) {
  g_user_data[this][key] = std::move(data);
}
void base::SupportsUserData::RemoveUserData(const void* key) {
  g_user_data[this].erase(key);
}
int PrefService::GetInteger(std::string_view p) const {
  return g_ints[std::string(p)];
}
bool PrefService::GetBoolean(std::string_view p) const {
  return g_bools[std::string(p)];
}
const base::ListValue& PrefService::GetList(std::string_view p) const {
  return g_lists[std::string(p)];
}
void PrefChangeRegistrar::Init(PrefService*) {}
void PrefChangeRegistrar::Add(std::string_view path,
                              base::RepeatingClosure obs) {
  g_pref_observers[std::string(path)] = obs;
}
namespace {
std::string g_update_path;
int g_list_writes = 0;
}  // namespace
ScopedListPrefUpdate::ScopedListPrefUpdate(PrefService*, std::string_view p) {
  g_update_path = std::string(p);
}
ScopedListPrefUpdate::~ScopedListPrefUpdate() = default;
base::ListValue& ScopedListPrefUpdate::Get() {
  ++g_list_writes;
  return g_lists[g_update_path];
}
void user_prefs::PrefRegistrySyncable::RegisterIntegerPref(std::string_view p,
                                                           int v,
                                                           unsigned) {
  g_ints[std::string(p)] = v;
}
void user_prefs::PrefRegistrySyncable::RegisterBooleanPref(std::string_view p,
                                                           bool v,
                                                           unsigned) {
  g_bools[std::string(p)] = v;
}
void user_prefs::PrefRegistrySyncable::RegisterListPref(std::string_view p,
                                                        unsigned) {
  g_lists[std::string(p)];
}
net::NetworkChangeNotifier::ConnectionCost
net::NetworkChangeNotifier::GetConnectionCost() {
  return g_cost;
}
net::NetworkChangeNotifier::ConnectionType
net::NetworkChangeNotifier::GetConnectionType() {
  return g_type;
}
bool net::NetworkChangeNotifier::IsConnectionCellular(ConnectionType t) {
  return t == CONNECTION_2G || t == CONNECTION_3G || t == CONNECTION_4G ||
         t == CONNECTION_5G;
}
void net::NetworkChangeNotifier::AddNetworkChangeObserver(
    NetworkChangeObserver* o) {
  g_net_observers.push_back(o);
}
void net::NetworkChangeNotifier::RemoveNetworkChangeObserver(
    NetworkChangeObserver* o) {
  std::erase(g_net_observers, o);
}
void net::NetworkChangeNotifier::AddConnectionCostObserver(
    ConnectionCostObserver*) {}
void net::NetworkChangeNotifier::RemoveConnectionCostObserver(
    ConnectionCostObserver*) {}
void download::SetParallelRequestCountOverride(int count) {
  g_connections_override = count;
}

// ---- Fakes.
class FakeItem : public DownloadItem {
 public:
  FakeItem(std::string guid, int start) : guid_(std::move(guid)) {
    start_.t = start;
  }
  ~FakeItem() override {
    for (auto* o : std::vector<Observer*>(observers_)) {
      o->OnDownloadDestroyed(this);
    }
    g_user_data.erase(this);
  }
  void AddObserver(Observer* o) override { observers_.push_back(o); }
  void RemoveObserver(Observer* o) override { std::erase(observers_, o); }
  void Pause() override {
    if (paused_ || IsDone()) return;
    paused_ = true;
    ++pauses;
    Notify();
  }
  void Resume(bool) override {
    if (!paused_ && state_ != INTERRUPTED) return;
    paused_ = false;
    state_ = IN_PROGRESS;
    ++resumes;
    Notify();
  }
  const std::string& GetGuid() const override { return guid_; }
  DownloadState GetState() const override { return state_; }
  bool IsPaused() const override { return paused_; }
  bool IsTemporary() const override { return false; }
  bool CanResume() const override {
    return paused_ || state_ == INTERRUPTED;
  }
  bool IsDone() const override {
    return state_ == COMPLETE || state_ == CANCELLED;
  }
  const std::string& GetLastModifiedTime() const override { return empty_; }
  const std::string& GetETag() const override { return etag; }
  bool IsSavePackageDownload() const override { return false; }
  const base::FilePath& GetTargetFilePath() const override { return target; }
  bool IsDangerous() const override { return false; }
  bool IsInsecure() const override { return false; }
  int64_t CurrentSpeed() const override { return 1000; }
  bool AllDataSaved() const override { return false; }
  const std::vector<ReceivedSlice>& GetReceivedSlices() const override {
    return slices;
  }
  base::Time GetStartTime() const override { return start_; }
  bool IsTransient() const override { return false; }
  bool IsParallelDownload() const override { return parallel; }

  // The user's actions and other changes.
  void UserPause() { Pause(); }
  void UserResume() { Resume(true); }
  void Complete() {
    state_ = COMPLETE;
    paused_ = false;
    Notify();
  }
  void Cancel() {
    state_ = CANCELLED;
    Notify();
  }
  void SetPausedSilently() { paused_ = true; }
  void Notify() {
    for (auto* o : std::vector<Observer*>(observers_)) {
      o->OnDownloadUpdated(this);
    }
  }
  void Progress() { Notify(); }

  std::string etag = "\"abc\"";
  base::FilePath target;
  bool parallel = false;
  std::vector<ReceivedSlice> slices;
  int pauses = 0;
  int resumes = 0;

 private:
  std::string guid_;
  std::string empty_;
  DownloadState state_ = IN_PROGRESS;
  bool paused_ = false;
  base::Time start_;
  std::vector<Observer*> observers_;
};

class FakeManager : public content::DownloadManager {
 public:
  virtual ~FakeManager() = default;
  void GetAllDownloads(DownloadVector* downloads) override {
    for (auto& i : items_) downloads->push_back(i.get());
  }
  DownloadItem* GetDownloadByGuid(const std::string& guid) override {
    for (auto& i : items_) {
      if (i->GetGuid() == guid) return i.get();
    }
    return nullptr;
  }
  void AddObserver(Observer* o) override { observers_.push_back(o); }
  void RemoveObserver(Observer* o) override { std::erase(observers_, o); }
  bool IsManagerInitialized() override { return true; }

  FakeItem* Add(const std::string& guid, int start, bool notify = true) {
    items_.push_back(std::make_unique<FakeItem>(guid, start));
    FakeItem* item = items_.back().get();
    if (notify) {
      for (auto* o : std::vector<Observer*>(observers_)) {
        o->OnDownloadCreated(this, item);
      }
    }
    return item;
  }
  void Created(FakeItem* item) {
    for (auto* o : std::vector<Observer*>(observers_)) {
      o->OnDownloadCreated(this, item);
    }
  }
  void Remove(FakeItem* item) {
    std::erase_if(items_, [item](auto& i) { return i.get() == item; });
  }
  void GoingDown() {
    for (auto* o : std::vector<Observer*>(observers_)) o->ManagerGoingDown(this);
  }

 private:
  std::vector<std::unique_ptr<FakeItem>> items_;
  std::vector<Observer*> observers_;
};

// ---- Checks.
int g_failures = 0;
void Check(bool ok, const char* what) {
  std::printf("%s %s\n", ok ? "ok  " : "FAIL", what);
  if (!ok) ++g_failures;
}
bool Running(FakeItem* i) {
  return i->GetState() == DownloadItem::IN_PROGRESS && !i->IsPaused();
}
Reason Why(FakeItem* i) { return CromikoDownloadQueue::GetWaitReason(i); }
bool Saved(FakeItem* i) {
  return g_lists["cromiko.downloads.queue"].contains(i->GetGuid());
}
void SetInt(const char* p, int v) {
  g_ints[p] = v;
  g_pref_observers[p].Run();
}
void SetBool(const char* p, bool v) {
  g_bools[p] = v;
  g_pref_observers[p].Run();
}
void SetNetwork(net::NetworkChangeNotifier::ConnectionType t) {
  g_type = t;
  for (auto* o : std::vector(g_net_observers)) o->OnNetworkChanged(t);
}

int main() {
  setvbuf(stdout, nullptr, _IONBF, 0);
  user_prefs::PrefRegistrySyncable registry;
  CromikoDownloadQueue::RegisterProfilePrefs(&registry);
  PrefService prefs;

  auto manager = std::make_unique<FakeManager>();
  auto queue = std::make_unique<CromikoDownloadQueue>(manager.get(), &prefs,
                                                      false);
  Check(g_connections_override == 4, "default: 4 connections");
  SetInt("cromiko.downloads.connections", 8);
  Check(g_connections_override == 8, "connections pref sets the override");
  SetInt("cromiko.downloads.connections", 40);
  Check(g_connections_override == 8, "connections are clamped to 8");

  FakeItem* a = manager->Add("a", 1);
  FakeItem* b = manager->Add("b", 2);
  FakeItem* c = manager->Add("c", 3);
  FakeItem* d = manager->Add("d", 4);
  FakeItem* e = manager->Add("e", 5);
  Check(Running(a) && Running(b) && Running(c), "limit 3: oldest three run");
  Check(!Running(d) && Why(d) == Reason::kQueue && Saved(d),
        "4th waits in the queue, saved");
  Check(!Running(e) && Why(e) == Reason::kQueue, "5th waits in the queue");
  int writes = g_list_writes;
  for (int i = 0; i < 5; i++) a->Progress();
  Check(g_list_writes == writes && a->pauses == 0,
        "progress updates change nothing");

  a->Complete();
  Check(Running(d) && Why(d) == Reason::kNone && !Saved(d),
        "a finishes: d starts and leaves the saved queue");
  Check(!Running(e), "e still waits");

  e->UserResume();
  Check(Running(e) && Running(b) && Running(c) && Running(d),
        "user resumes e: it runs over the limit, nothing else pauses");

  b->UserPause();
  Check(!Running(b) && Why(b) == Reason::kNone, "user pauses b: not queued");
  Check(Running(c) && Running(d) && Running(e), "the others keep running");
  b->UserResume();
  Check(Running(b) && Running(c) && Running(d),
        "user resumes b: it runs right away");

  SetBool("cromiko.downloads.wifi_only", true);
  Check(Running(b) && Running(c) && Running(d) && Running(e),
        "wifi only on Wi-Fi: all run");
  SetNetwork(net::NetworkChangeNotifier::CONNECTION_4G);
  Check(Running(b) && Running(e), "mobile data: user-resumed downloads run");
  Check(Why(c) == Reason::kWifi && Why(d) == Reason::kWifi,
        "mobile data: the others wait for Wi-Fi");
  FakeItem* f = manager->Add("f", 6);
  Check(Why(f) == Reason::kWifi, "new download on mobile data waits for Wi-Fi");
  SetNetwork(net::NetworkChangeNotifier::CONNECTION_WIFI);
  Check(Running(c) && Running(d) && Running(f), "back on Wi-Fi: they resume");
  SetBool("cromiko.downloads.wifi_only", false);

  SetInt("cromiko.downloads.max_active", 1);
  Check(Running(c) && Why(d) == Reason::kQueue && Why(f) == Reason::kQueue,
        "limit 1: only the oldest non-forced one runs");
  Check(Running(b) && Running(e), "forced ones still run");

  // A download without validators cannot wait.
  FakeItem* g = manager->Add("g", 7, false);
  g->etag.clear();
  manager->Created(g);
  Check(Running(g), "no validator: runs over the limit");
  FakeItem* g2 = manager->Add("g2", 9);
  Check(Why(g2) == Reason::kQueue, "a later download with validator waits");

  // A download whose target is not chosen yet waits only after.
  FakeItem* h = manager->Add("h", 8, false);
  h->target.e = true;
  manager->Created(h);
  Check(Running(h), "target not chosen: runs");
  h->target.e = false;
  h->Notify();
  Check(Why(h) == Reason::kQueue, "target chosen: waits in the queue");

  // Cancelling a waiting download removes it from the saved queue.
  Check(Saved(f), "f is saved");
  f->Cancel();
  Check(!Saved(f), "f cancelled: no longer saved");

  // Removing a waiting download too.
  Check(Saved(h), "h is saved");
  manager->Remove(h);
  Check(!g_lists["cromiko.downloads.queue"].contains("h"),
        "h removed: no longer saved");

  // Connections.
  Check(CromikoDownloadQueue::GetConnectionCount(c) == 1, "1 connection");
  c->parallel = true;
  c->slices = {{0, 10, true}, {10, 10, false}, {20, 10, false}, {30, 0, false}};
  Check(CromikoDownloadQueue::GetConnectionCount(c) == 3, "3 connections");
  Check(CromikoDownloadQueue::GetConnectionCount(d) == 0,
        "waiting: 0 connections");

  // Restart: the queue is saved, and the downloads come back paused.
  std::vector<std::string> saved;
  for (const base::Value& v : g_lists["cromiko.downloads.queue"]) {
    saved.push_back(v.GetString());
  }
  Check(saved.size() >= 2, "several downloads saved in the queue");
  manager->GoingDown();
  queue.reset();
  manager = std::make_unique<FakeManager>();
  FakeItem* r1 = manager->Add("c", 3, false);
  FakeItem* r2 = manager->Add("d", 4, false);
  r2->SetPausedSilently();
  FakeItem* r3 = manager->Add("user-paused", 2, false);
  r3->SetPausedSilently();
  g_lists["cromiko.downloads.queue"].Append("gone");
  queue = std::make_unique<CromikoDownloadQueue>(manager.get(), &prefs, false);
  Check(Running(r1) && Why(r2) == Reason::kQueue,
        "after a restart, d still waits");
  Check(!Running(r3) && Why(r3) == Reason::kNone,
        "a download the user paused stays paused");
  Check(!g_lists["cromiko.downloads.queue"].contains("gone"),
        "unknown downloads are pruned from the saved queue");
  r1->Complete();
  Check(Running(r2), "c finishes: d resumes");
  Check(!Running(r3), "user-paused download is not resumed by the queue");

  // Off the record queues are not saved.
  manager->GoingDown();
  queue.reset();
  manager = std::make_unique<FakeManager>();
  size_t before = g_lists["cromiko.downloads.queue"].size();
  queue = std::make_unique<CromikoDownloadQueue>(manager.get(), &prefs, true);
  manager->Add("o1", 1);
  FakeItem* o2 = manager->Add("o2", 2);
  Check(Why(o2) == Reason::kQueue, "incognito: queue works");
  Check(g_lists["cromiko.downloads.queue"].size() == before,
        "incognito: queue not saved");
  SetInt("cromiko.downloads.max_active", 0);
  Check(Running(o2), "no limit: all run");
  manager->GoingDown();
  queue.reset();

  std::printf(g_failures ? "%d FAILED\n" : "ALL PASS\n", g_failures);
  return g_failures ? 1 : 0;
}
