import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/utils/api';
import { Ionicons } from '@expo/vector-icons';

interface Device {
  device_id: string;
  nazwa: string;
  numer_seryjny: string;
  kod_kreskowy?: string;
  kod_qr?: string;
  przypisany_do?: string;
  status: string;
}

interface Worker {
  user_id: string;
  name: string;
  email: string;
}

export default function Devices() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [assignModalVisible, setAssignModalVisible] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated]);

  const loadData = async () => {
    try {
      const [devicesData, workersData] = await Promise.all([
        apiFetch('/api/devices'),
        apiFetch('/api/workers'),
      ]);
      setDevices(devicesData);
      setWorkers(workersData);
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleAssign = async (workerId: string) => {
    if (!selectedDevice) return;
    
    try {
      await apiFetch(`/api/devices/${selectedDevice.device_id}/assign`, {
        method: 'POST',
        body: { worker_id: workerId },
      });
      
      Alert.alert('Sukces', 'Urządzenie zostało przypisane');
      setAssignModalVisible(false);
      setSelectedDevice(null);
      loadData();
    } catch (error: any) {
      Alert.alert('Błąd', error.message);
    }
  };

  const filteredDevices = devices.filter((device) => {
    const matchesSearch =
      device.nazwa.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.numer_seryjny.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = !statusFilter || device.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusFilters = [
    { key: null, label: 'Wszystkie' },
    { key: 'dostepny', label: 'Dostępne' },
    { key: 'przypisany', label: 'Przypisane' },
    { key: 'zainstalowany', label: 'Zainstalowane' },
  ];

  const renderDevice = ({ item }: { item: Device }) => {
    const assignedWorker = workers.find((w) => w.user_id === item.przypisany_do);
    
    return (
      <TouchableOpacity
        style={styles.deviceCard}
        onPress={() => {
          if (user?.role === 'admin' && item.status === 'dostepny') {
            setSelectedDevice(item);
            setAssignModalVisible(true);
          }
        }}
      >
        <View style={styles.deviceHeader}>
          <Ionicons name="hardware-chip-outline" size={24} color="#3b82f6" />
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName}>{item.nazwa}</Text>
            <Text style={styles.deviceSerial}>S/N: {item.numer_seryjny}</Text>
          </View>
          <View
            style={[
              styles.statusBadge,
              item.status === 'dostepny' && { backgroundColor: '#10b981' },
              item.status === 'przypisany' && { backgroundColor: '#3b82f6' },
              item.status === 'zainstalowany' && { backgroundColor: '#f59e0b' },
            ]}
          >
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        
        {assignedWorker && (
          <View style={styles.assignedInfo}>
            <Ionicons name="person-outline" size={16} color="#888" />
            <Text style={styles.assignedText}>{assignedWorker.name}</Text>
          </View>
        )}
        
        {item.kod_kreskowy && (
          <View style={styles.codeInfo}>
            <Ionicons name="barcode-outline" size={16} color="#888" />
            <Text style={styles.codeText}>{item.kod_kreskowy}</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Urządzenia</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Szukaj urządzenia..."
          placeholderTextColor="#888"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Status Filters */}
      <View style={styles.filtersContainer}>
        {statusFilters.map((filter) => (
          <TouchableOpacity
            key={filter.key || 'all'}
            style={[
              styles.filterButton,
              statusFilter === filter.key && styles.filterButtonActive,
            ]}
            onPress={() => setStatusFilter(filter.key)}
          >
            <Text
              style={[
                styles.filterText,
                statusFilter === filter.key && styles.filterTextActive,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Device List */}
      <FlatList
        data={filteredDevices}
        renderItem={renderDevice}
        keyExtractor={(item) => item.device_id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={64} color="#333" />
            <Text style={styles.emptyText}>Brak urządzeń</Text>
          </View>
        }
      />

      {/* Assign Modal */}
      <Modal
        visible={assignModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAssignModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Przypisz do pracownika</Text>
              <TouchableOpacity onPress={() => setAssignModalVisible(false)}>
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
            
            {selectedDevice && (
              <View style={styles.modalDeviceInfo}>
                <Text style={styles.modalDeviceName}>{selectedDevice.nazwa}</Text>
                <Text style={styles.modalDeviceSerial}>{selectedDevice.numer_seryjny}</Text>
              </View>
            )}
            
            <FlatList
              data={workers}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.workerItem}
                  onPress={() => handleAssign(item.user_id)}
                >
                  <View style={styles.workerAvatar}>
                    <Ionicons name="person" size={24} color="#fff" />
                  </View>
                  <View style={styles.workerInfo}>
                    <Text style={styles.workerName}>{item.name}</Text>
                    <Text style={styles.workerEmail}>{item.email}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#888" />
                </TouchableOpacity>
              )}
              keyExtractor={(item) => item.user_id}
              ListEmptyComponent={
                <Text style={styles.noWorkersText}>Brak pracowników</Text>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  backButton: {
    padding: 8,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    margin: 16,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 14,
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#1a1a1a',
  },
  filterButtonActive: {
    backgroundColor: '#3b82f6',
  },
  filterText: {
    color: '#888',
    fontSize: 13,
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContainer: {
    padding: 16,
    paddingTop: 0,
  },
  deviceCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deviceInfo: {
    flex: 1,
    marginLeft: 12,
  },
  deviceName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deviceSerial: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  assignedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  assignedText: {
    color: '#888',
    fontSize: 13,
    marginLeft: 8,
  },
  codeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  codeText: {
    color: '#666',
    fontSize: 12,
    marginLeft: 8,
    fontFamily: 'monospace',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  modalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  modalDeviceInfo: {
    padding: 20,
    backgroundColor: '#0a0a0a',
  },
  modalDeviceName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalDeviceSerial: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
  },
  workerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  workerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  workerInfo: {
    flex: 1,
    marginLeft: 12,
  },
  workerName: {
    color: '#fff',
    fontSize: 16,
  },
  workerEmail: {
    color: '#888',
    fontSize: 13,
  },
  noWorkersText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    padding: 20,
  },
});
