import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
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
  showChatNotification: boolean;
  chatNotificationData: { sender: string; preview: string } | null;
  dismissChatNotification: () => void;
  markChatAsRead: () => void;
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
  const [showChatNotification, setShowChatNotification] = useState(false);
  const [chatNotificationData, setChatNotificationData] = useState<{ sender: string; preview: string } | null>(null);
  const [lastShownMessageId, setLastShownMessageId] = useState<string | null>(null);

  const isOnChatScreen = pathname === '/chat';

  const dismissChatNotification = useCallback(() => {
    setShowChatNotification(false);
    setChatNotificationData(null);
  }, []);

  const markChatAsRead = useCallback(async () => {
    if (!user) return;
    const lastCheckKey = `lastChatCheck_${user.user_id}`;
    await AsyncStorage.setItem(lastCheckKey, new Date().toISOString());
    setUnreadChatCount(0);
    setShowChatNotification(false);
    setChatNotificationData(null);
  }, [user]);

  const checkForNewMessages = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    try {
      const messages: ChatMessage[] = await apiFetch('/api/messages?limit=50');
      
      if (messages.length === 0) return;

      const lastCheckKey = `lastChatCheck_${user.user_id}`;
      const lastCheckTimestamp = await AsyncStorage.getItem(lastCheckKey);
      
      // Filter messages from others
      const messagesFromOthers = messages.filter(m => m.sender_id !== user.user_id);
      
      if (messagesFromOthers.length === 0) {
        setUnreadChatCount(0);
        return;
      }

      // Calculate unread count
      let unreadCount = 0;
      let newMessages: ChatMessage[] = [];
      
      if (lastCheckTimestamp) {
        const lastCheck = new Date(lastCheckTimestamp);
        newMessages = messagesFromOthers.filter(m => new Date(m.created_at) > lastCheck);
        unreadCount = newMessages.length;
      } else {
        // First time - count messages from last 2 hours
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
        newMessages = messagesFromOthers.filter(m => new Date(m.created_at) > twoHoursAgo);
        unreadCount = newMessages.length;
      }

      setUnreadChatCount(unreadCount);

      // Show notification if not on chat screen and has new messages
      if (!isOnChatScreen && newMessages.length > 0) {
        const newestMessage = newMessages[0];
        // Only show if this is a new message we haven't shown before
        if (newestMessage.message_id !== lastShownMessageId) {
          setLastShownMessageId(newestMessage.message_id);
          setChatNotificationData({
            sender: newestMessage.sender_name,
            preview: newestMessage.content?.substring(0, 50) || '[załącznik]'
          });
          setShowChatNotification(true);
          
          // Auto-hide after 8 seconds
          setTimeout(() => {
            setShowChatNotification(false);
          }, 8000);
        }
      }
    } catch (error) {
      console.error('Error checking messages:', error);
    }
  }, [isAuthenticated, user, isOnChatScreen, lastShownMessageId]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    if (!isAuthenticated) return;

    // Initial check after 2 seconds
    const timeout = setTimeout(checkForNewMessages, 2000);
    
    // Set up polling
    const interval = setInterval(checkForNewMessages, 5000);
    
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [isAuthenticated, checkForNewMessages]);

  // Hide notification when entering chat screen
  useEffect(() => {
    if (isOnChatScreen) {
      dismissChatNotification();
      markChatAsRead();
    }
  }, [isOnChatScreen, dismissChatNotification, markChatAsRead]);

  const handleNotificationPress = () => {
    dismissChatNotification();
    router.push('/chat');
  };

  return (
    <NotificationContext.Provider
      value={{
        unreadChatCount,
        showChatNotification,
        chatNotificationData,
        dismissChatNotification,
        markChatAsRead,
      }}
    >
      {children}
      
      {/* Global Chat Notification Banner */}
      {showChatNotification && chatNotificationData && !isOnChatScreen && (
        <View style={styles.notificationContainer}>
          <TouchableOpacity 
            style={styles.notificationBanner}
            onPress={handleNotificationPress}
            activeOpacity={0.95}
          >
            <View style={styles.notificationIcon}>
              <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
            </View>
            <View style={styles.notificationText}>
              <Text style={styles.notificationTitle}>💬 Nowa wiadomość</Text>
              <Text style={styles.notificationPreview} numberOfLines={1}>
                {chatNotificationData.sender}: {chatNotificationData.preview}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.notificationClose}
              onPress={dismissChatNotification}
            >
              <Ionicons name="close-circle" size={24} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
          </TouchableOpacity>
        </View>
      )}
    </NotificationContext.Provider>
  );
}

const styles = StyleSheet.create({
  notificationContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 0,
    right: 0,
    zIndex: 99999,
    elevation: 99999,
    paddingHorizontal: 16,
  },
  notificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#10b981',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
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
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    marginTop: 2,
  },
  notificationClose: {
    padding: 4,
  },
});
