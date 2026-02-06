import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || '';

interface FetchOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

export async function apiFetch(endpoint: string, options: FetchOptions = {}) {
  const token = await AsyncStorage.getItem('session_token');
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Błąd serwera' }));
    throw new Error(errorData.detail || 'Wystąpił błąd');
  }
  
  return response.json();
}

export async function uploadFile(endpoint: string, file: any) {
  const token = await AsyncStorage.getItem('session_token');
  
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Błąd serwera' }));
    throw new Error(errorData.detail || 'Wystąpił błąd');
  }
  
  return response.json();
}
