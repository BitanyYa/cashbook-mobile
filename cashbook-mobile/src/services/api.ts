import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_API_URL;

if (!API_URL) {
  throw new Error('EXPO_PUBLIC_API_URL is not configured');
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await SecureStore.getItemAsync('accessToken');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Remainder': 'true',
    'bypass-tunnel-remainder': 'true',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token && !headers['Authorization'] && !headers['authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch (e) {
    console.error('API Non-JSON Response:', text);
    throw new Error('Server returned an unexpected response. Please try again.');
  }

  if (!response.ok) {
    throw new Error(
      Array.isArray(data.message)
        ? data.message.join(', ')
        : data.message || 'Something went wrong',
    );
  }

  return data;
}
