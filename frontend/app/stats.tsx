import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../src/context/AuthContext';
import { apiFetch } from '../src/utils/api';
import { Ionicons } from '@expo/vector-icons';
import { format, subDays } from 'date-fns';
import { pl } from 'date-fns/locale';

interface Stats {
  total: number;
  by_type: Record<string, number>;
  by_user: Record<string, number>;
  daily: Array<{ _id: string; count: number }>;
}

interface Worker {
  user_id: string;
  name: string;
}

export default function Stats() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated]);

  const loadData = async () => {
    try {
      const [statsData, workersData] = await Promise.all([
        apiFetch('/api/installations/stats'),
        apiFetch('/api/workers'),
      ]);
      setStats(statsData);
      setWorkers(workersData);
    } catch (error) {
      console.error('Error loading stats:', error);
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

  const getWorkerName = (userId: string) => {
    const worker = workers.find((w) => w.user_id === userId);
    return worker?.name || 'Nieznany';
  };

  const typeColors: Record<string, string> = {
    instalacja: '#10b981',
    wymiana: '#3b82f6',
    awaria: '#ef4444',
    uszkodzony: '#f59e0b',
  };

  const typeIcons: Record<string, string> = {
    instalacja: 'add-circle',
    wymiana: 'swap-horizontal',
    awaria: 'warning',
    uszkodzony: 'alert-circle',
  };

  // Generate last 7 days for chart
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = subDays(new Date(), 6 - i);
    return format(date, 'yyyy-MM-dd');
  });

  const getMaxCount = () => {
    if (!stats?.daily) return 1;
    const max = Math.max(...stats.daily.map((d) => d.count), 1);
    return max;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.title}>Statystyki</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
        }
      >
        {/* Total Card */}
        <View style={styles.totalCard}>
          <Ionicons name="stats-chart" size={32} color="#3b82f6" />
          <Text style={styles.totalNumber}>{stats?.total || 0}</Text>
          <Text style={styles.totalLabel}>Wszystkich instalacji</Text>
        </View>

        {/* Types Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Według typu zlecenia</Text>
          <View style={styles.typesGrid}>
            {Object.entries(stats?.by_type || {}).map(([type, count]) => (
              <View key={type} style={styles.typeCard}>
                <View style={[styles.typeIcon, { backgroundColor: typeColors[type] || '#888' }]}>
                  <Ionicons
                    name={(typeIcons[type] || 'help-circle') as any}
                    size={20}
                    color="#fff"
                  />
                </View>
                <Text style={styles.typeCount}>{count}</Text>
                <Text style={styles.typeLabel}>{type}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Daily Chart Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Ostatnie 7 dni</Text>
          <View style={styles.chartContainer}>
            <View style={styles.chart}>
              {last7Days.map((day) => {
                const dayData = stats?.daily?.find((d) => d._id === day);
                const count = dayData?.count || 0;
                const height = Math.max((count / getMaxCount()) * 100, 4);
                
                return (
                  <View key={day} style={styles.chartBarContainer}>
                    <Text style={styles.chartValue}>{count}</Text>
                    <View style={[styles.chartBar, { height }]} />
                    <Text style={styles.chartLabel}>
                      {format(new Date(day), 'E', { locale: pl })}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* By Worker Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Według pracownika</Text>
          <View style={styles.workersList}>
            {Object.entries(stats?.by_user || {})
              .sort(([, a], [, b]) => b - a)
              .map(([userId, count], index) => (
                <View key={userId} style={styles.workerItem}>
                  <View style={styles.workerRank}>
                    <Text style={styles.workerRankText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.workerName}>{getWorkerName(userId)}</Text>
                  <View style={styles.workerCountBadge}>
                    <Text style={styles.workerCount}>{count}</Text>
                  </View>
                </View>
              ))}
            {Object.keys(stats?.by_user || {}).length === 0 && (
              <Text style={styles.noDataText}>Brak danych</Text>
            )}
          </View>
        </View>

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
  totalCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  totalNumber: {
    color: '#fff',
    fontSize: 48,
    fontWeight: 'bold',
    marginTop: 12,
  },
  totalLabel: {
    color: '#888',
    fontSize: 14,
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  typesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  typeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeCount: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 12,
  },
  typeLabel: {
    color: '#888',
    fontSize: 13,
    marginTop: 4,
    textTransform: 'capitalize',
  },
  chartContainer: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 16,
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
  },
  chartBarContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  chartValue: {
    color: '#fff',
    fontSize: 12,
    marginBottom: 4,
  },
  chartBar: {
    width: 24,
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  chartLabel: {
    color: '#888',
    fontSize: 11,
    marginTop: 8,
    textTransform: 'capitalize',
  },
  workersList: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    overflow: 'hidden',
  },
  workerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  workerRank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  workerRankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  workerName: {
    flex: 1,
    color: '#fff',
    fontSize: 15,
  },
  workerCountBadge: {
    backgroundColor: '#0a0a0a',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  workerCount: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  noDataText: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
    padding: 24,
  },
});
