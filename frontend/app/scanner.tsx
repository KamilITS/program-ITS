import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Camera, CameraView } from 'expo-camera';
import * as Location from 'expo-location';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/utils/api';
import { Ionicons } from '@expo/vector-icons';

interface Device {
  device_id: string;
  nazwa: string;
  numer_seryjny: string;
  kod_kreskowy?: string;
  kod_qr?: string;
  status: string;
}

export default function Scanner() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [device, setDevice] = useState<Device | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [address, setAddress] = useState('');
  const [orderType, setOrderType] = useState<string>('instalacja');
  const [showCamera, setShowCamera] = useState(false);

  const orderTypes = ['instalacja', 'wymiana', 'awaria', 'uszkodzony'];

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated]);

  useEffect(() => {
    (async () => {
      const { status: cameraStatus } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(cameraStatus === 'granted');
      
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        
        // Reverse geocode
        try {
          const [addr] = await Location.reverseGeocodeAsync({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          if (addr) {
            setAddress(`${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}`);
          }
        } catch (error) {
          console.error('Geocoding error:', error);
        }
      }
    })();
  }, []);

  const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    setShowCamera(false);
    await searchDevice(data);
  };

  const searchDevice = async (code: string) => {
    if (!code.trim()) {
      Alert.alert('Błąd', 'Wprowadź kod urządzenia');
      return;
    }
    
    setIsSearching(true);
    try {
      const foundDevice = await apiFetch(`/api/devices/scan/${encodeURIComponent(code)}`);
      setDevice(foundDevice);
    } catch (error: any) {
      Alert.alert('Nie znaleziono', 'Urządzenie o podanym kodzie nie istnieje w systemie');
      setDevice(null);
    } finally {
      setIsSearching(false);
    }
  };

  const handleInstall = async () => {
    if (!device) return;
    
    setIsInstalling(true);
    try {
      await apiFetch('/api/installations', {
        method: 'POST',
        body: {
          device_id: device.device_id,
          adres: address,
          latitude: location?.latitude,
          longitude: location?.longitude,
          rodzaj_zlecenia: orderType,
        },
      });
      
      Alert.alert(
        'Sukces',
        `Urządzenie "${device.nazwa}" zostało zarejestrowane jako ${orderType}`,
        [{ text: 'OK', onPress: () => {
          setDevice(null);
          setScanned(false);
          setManualCode('');
        }}]
      );
    } catch (error: any) {
      Alert.alert('Błąd', error.message || 'Nie udało się zarejestrować instalacji');
    } finally {
      setIsInstalling(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Skanuj urządzenie</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Camera Scanner */}
        {showCamera && hasPermission ? (
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39'],
              }}
            />
            <TouchableOpacity
              style={styles.closeCameraButton}
              onPress={() => setShowCamera(false)}
            >
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.scanButton}
            onPress={() => {
              setScanned(false);
              setShowCamera(true);
            }}
            disabled={!hasPermission}
          >
            <Ionicons name="scan" size={48} color="#3b82f6" />
            <Text style={styles.scanButtonText}>
              {hasPermission === false
                ? 'Brak dostępu do kamery'
                : 'Dotknij aby skanować'}
            </Text>
          </TouchableOpacity>
        )}

        {/* Manual Input */}
        <View style={styles.manualSection}>
          <Text style={styles.sectionTitle}>Lub wpisz kod ręcznie</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Numer seryjny lub kod"
              placeholderTextColor="#666"
              value={manualCode}
              onChangeText={setManualCode}
            />
            <TouchableOpacity
              style={styles.searchButton}
              onPress={() => searchDevice(manualCode)}
              disabled={isSearching}
            >
              {isSearching ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="search" size={24} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Device Info */}
        {device && (
          <View style={styles.deviceSection}>
            <Text style={styles.sectionTitle}>Znalezione urządzenie</Text>
            <View style={styles.deviceCard}>
              <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{device.nazwa}</Text>
                <Text style={styles.deviceSerial}>S/N: {device.numer_seryjny}</Text>
                <View style={[
                  styles.statusBadge,
                  device.status === 'dostepny' && { backgroundColor: '#10b981' },
                  device.status === 'przypisany' && { backgroundColor: '#3b82f6' },
                  device.status === 'zainstalowany' && { backgroundColor: '#f59e0b' },
                ]}>
                  <Text style={styles.statusText}>{device.status}</Text>
                </View>
              </View>

              {/* Location */}
              <View style={styles.locationInfo}>
                <Ionicons name="location" size={20} color="#3b82f6" />
                <Text style={styles.locationText}>{address || 'Pobieranie lokalizacji...'}</Text>
              </View>

              {/* Order Type Selection */}
              <Text style={styles.orderTypeLabel}>Rodzaj zlecenia:</Text>
              <View style={styles.orderTypes}>
                {orderTypes.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.orderTypeButton,
                      orderType === type && styles.orderTypeButtonActive,
                    ]}
                    onPress={() => setOrderType(type)}
                  >
                    <Text style={[
                      styles.orderTypeText,
                      orderType === type && styles.orderTypeTextActive,
                    ]}>
                      {type}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Install Button */}
              <TouchableOpacity
                style={styles.installButton}
                onPress={handleInstall}
                disabled={isInstalling}
              >
                {isInstalling ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={24} color="#fff" />
                    <Text style={styles.installButtonText}>Zarejestruj</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'center',
    alignItems: 'center',
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
  content: {
    flex: 1,
    padding: 16,
  },
  cameraContainer: {
    height: 300,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  closeCameraButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 8,
  },
  scanButton: {
    height: 200,
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanButtonText: {
    color: '#888',
    fontSize: 16,
    marginTop: 12,
  },
  manualSection: {
    marginTop: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
  },
  searchButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    width: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceSection: {
    marginTop: 24,
  },
  deviceCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
  },
  deviceInfo: {
    marginBottom: 16,
  },
  deviceName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  deviceSerial: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    marginTop: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  locationText: {
    color: '#fff',
    fontSize: 14,
    marginLeft: 8,
    flex: 1,
  },
  orderTypeLabel: {
    color: '#888',
    fontSize: 14,
    marginBottom: 8,
  },
  orderTypes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  orderTypeButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#0a0a0a',
    borderWidth: 1,
    borderColor: '#333',
  },
  orderTypeButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  orderTypeText: {
    color: '#888',
    fontSize: 14,
    textTransform: 'capitalize',
  },
  orderTypeTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  installButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  installButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
