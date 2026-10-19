#pragma once
namespace net { class NetworkChangeNotifier { public:
  enum ConnectionType { CONNECTION_UNKNOWN = 0, CONNECTION_ETHERNET, CONNECTION_WIFI, CONNECTION_2G, CONNECTION_3G, CONNECTION_4G, CONNECTION_NONE, CONNECTION_BLUETOOTH, CONNECTION_5G };
  enum ConnectionCost { CONNECTION_COST_UNKNOWN = 0, CONNECTION_COST_UNMETERED, CONNECTION_COST_METERED };
  class NetworkChangeObserver { public: virtual void OnNetworkChanged(ConnectionType type) = 0; protected: virtual ~NetworkChangeObserver() = default; };
  class ConnectionCostObserver { public: virtual void OnConnectionCostChanged(ConnectionCost Cost) = 0; protected: virtual ~ConnectionCostObserver() = default; };
  static ConnectionCost GetConnectionCost(); static ConnectionType GetConnectionType(); static bool IsConnectionCellular(ConnectionType type);
  static void AddNetworkChangeObserver(NetworkChangeObserver*); static void RemoveNetworkChangeObserver(NetworkChangeObserver*);
  static void AddConnectionCostObserver(ConnectionCostObserver*); static void RemoveConnectionCostObserver(ConnectionCostObserver*); }; }
