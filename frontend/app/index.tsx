import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image } from 'react-native';
import { useAuth } from '../src/context/AuthContext';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function Index() {
  const { user, isLoading, isAuthenticated, login } = useAuth();

  React.useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.replace('/dashboard');
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Ładowanie...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Ionicons name="cube-outline" size={80} color="#3b82f6" />
          <Text style={styles.title}>Magazyn ITS</Text>
          <Text style={styles.subtitle}>Kielce</Text>
        </View>

        <Text style={styles.description}>
          System zarządzania magazynem{'\n'}i pracownikami
        </Text>

        <View style={styles.features}>
          <View style={styles.featureItem}>
            <Ionicons name="barcode-outline" size={24} color="#3b82f6" />
            <Text style={styles.featureText}>Skanowanie urządzeń</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="location-outline" size={24} color="#3b82f6" />
            <Text style={styles.featureText}>Śledzenie lokalizacji</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="chatbubbles-outline" size={24} color="#3b82f6" />
            <Text style={styles.featureText}>Komunikator</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="calendar-outline" size={24} color="#3b82f6" />
            <Text style={styles.featureText}>Planer zadań</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.loginButton} onPress={login}>
          <Ionicons name="logo-google" size={24} color="#fff" />
          <Text style={styles.loginButtonText}>Zaloguj przez Google</Text>
        </TouchableOpacity>
      </View>
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
  loadingText: {
    color: '#888',
    marginTop: 16,
    fontSize: 16,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 24,
    color: '#3b82f6',
    fontWeight: '600',
  },
  description: {
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  features: {
    width: '100%',
    marginBottom: 48,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 8,
  },
  featureText: {
    color: '#fff',
    fontSize: 16,
    marginLeft: 12,
  },
  loginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
});
