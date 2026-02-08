import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from './AuthContext';
import { apiFetch } from '../utils/api';

interface ChatMessage {
  message_id: string;
  sender_id: string;
  sender_name: string;
  content?: string;
  created_at: string;
}

interface NotificationContextType {
  unreadChatCount: number;
  newChatNotification: { sender: string; preview: string } | null;
  dismissChatNotification: () => void;
  markChatAsRead: () => void;
  refreshNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [newChatNotification, setNewChatNotification] = useState<{ sender: string; preview: string } | null>(null);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);
  
  // Animation for notification
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const [showBanner, setShowBanner] = useState(false);

  const isOnChatScreen = pathname === '/chat';

  const checkForNewMessages = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    try {
      const messages: ChatMessage[] = await apiFetch('/api/messages?limit=50');
      
      if (messages.length === 0) return;

      // Get last check timestamp
      const lastCheckKey = `lastChatCheck_${user.user_id}`;
      const lastCheckTimestamp = await AsyncStorage.getItem(lastCheckKey);
      
      // Filter messages from others
      const messagesFromOthers = messages.filter(m => m.sender_id !== user.user_id);
      
      if (messagesFromOthers.length === 0) return;

      // Count unread messages
      let unreadCount = 0;
      const newestMessage = messagesFromOthers[0];
      
      if (lastCheckTimestamp) {
        const lastCheck = new Date(lastCheckTimestamp);
        unreadCount = messagesFromOthers.filter(m => new Date(m.created_at) > lastCheck).length;
      } else {
        // First time - count messages from last 2 hours
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        unreadCount = messagesFromOthers.filter(m => new Date(m.created_at) > twoHoursAgo).length;
      }

      setUnreadChatCount(unreadCount);

      // Show notification only if:
      // 1. There's a new message (different from last one we showed)
      // 2. User is NOT on chat screen
      // 3. There are unread messages
      if (
        newestMessage && 
        newestMessage.message_id !== lastMessageId && 
        !isOnChatScreen && 
        unreadCount > 0
      ) {
        setLastMessageId(newestMessage.message_id);
        setNewChatNotification({
          sender: newestMessage.sender_name,
          preview: newestMessage.content?.substring(0, 50) || '[załącznik]'
        });
        setShowBanner(true);
        
        // Animate in
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 80,
          friction: 10,
        }).start();

        // Auto-hide after 5 seconds
        setTimeout(() => {
          hideBanner();
        }, 5000);
      }
    } catch (error) {
      console.error('Error checking messages:', error);
    }
  }, [isAuthenticated, user, isOnChatScreen, lastMessageId, slideAnim]);

  const hideBanner = useCallback(() => {
    Animated.timing(slideAnim, {
      toValue: -100,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      setShowBanner(false);
      setNewChatNotification(null);
    });
  }, [slideAnim]);

  const dismissChatNotification = useCallback(() => {
    hideBanner();
  }, [hideBanner]);

  const markChatAsRead = useCallback(async () => {
    if (!user) return;
    const lastCheckKey = `lastChatCheck_${user.user_id}`;
    await AsyncStorage.setItem(lastCheckKey, new Date().toISOString());
    setUnreadChatCount(0);
    setNewChatNotification(null);
    hideBanner();
  }, [user, hideBanner]);

  const refreshNotifications = useCallback(() => {
    checkForNewMessages();
  }, [checkForNewMessages]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    checkForNewMessages();
    const interval = setInterval(checkForNewMessages, 5000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, checkForNewMessages]);

  // Hide notification when entering chat screen
  useEffect(() => {
    if (isOnChatScreen) {
      hideBanner();
      markChatAsRead();
    }
  }, [isOnChatScreen, hideBanner, markChatAsRead]);

  const handleNotificationPress = () => {
    hideBanner();
    router.push('/chat');
  };

  return (
    <NotificationContext.Provider
      value={{
        unreadChatCount,
        newChatNotification,
        dismissChatNotification,
        markChatAsRead,
        refreshNotifications,
      }}
    >
      {children}
      
      {/* Global Chat Notification Banner */}
      {showBanner && newChatNotification && (
        <Animated.View 
          style={[
            styles.notificationBanner,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <TouchableOpacity 
            style={styles.notificationContent}
            onPress={handleNotificationPress}
            activeOpacity={0.9}
          >
            <View style={styles.notificationIcon}>
              <Ionicons name="chatbubbles" size={24} color="#fff" />
            </View>
            <View style={styles.notificationText}>
              <Text style={styles.notificationTitle}>
                💬 Nowa wiadomość
              </Text>
              <Text style={styles.notificationPreview} numberOfLines={1}>
                {newChatNotification.sender}: {newChatNotification.preview}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.notificationClose}
              onPress={dismissChatNotification}
            >
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </TouchableOpacity>
        </Animated.View>
      )}
    </NotificationContext.Provider>
  );
}

const styles = StyleSheet.create({
  notificationBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 16,
    right: 16,
    zIndex: 9999,
    elevation: 10,
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationText: {
    flex: 1,
    marginLeft: 12,
  },
  notificationTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  notificationPreview: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    marginTop: 2,
  },
  notificationClose: {
    padding: 8,
  },
});
