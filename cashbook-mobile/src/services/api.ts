import * as SecureStore from 'expo-secure-store';

const CURRENT_ACTIVE_TUNNEL = 'https://arch-qualified-textiles-knowledge.trycloudflare.com';
export const API_URL = CURRENT_ACTIVE_TUNNEL;

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
    console.error(`API Non-JSON Response (status ${response.status}):`, text ? text.slice(0, 300) : '');
    if (response.status === 502 || response.status === 503 || response.status === 504 || (text && text.includes('Bad Gateway'))) {
      throw new Error('Backend server was restarting. Please try again now.');
    }
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

/**
 * apiUpload uses XMLHttpRequest to support React Native's multipart FormData
 * with local file URIs ({ uri, name, type }), completely bypassing Expo fetch's
 * convertFormDataAsync which throws 'Unsupported FormDataPart implementation'.
 */
export function apiUpload<T>(
  endpoint: string,
  formData: FormData,
  method: string = 'POST',
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      const xhr = new XMLHttpRequest();
      xhr.open(method, `${API_URL}${endpoint}`);
      xhr.setRequestHeader('Bypass-Tunnel-Remainder', 'true');
      xhr.setRequestHeader('bypass-tunnel-remainder', 'true');

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      xhr.onload = () => {
        let data: any;
        try {
          data = JSON.parse(xhr.responseText);
        } catch (e) {
          console.error(`API Upload Non-JSON Response (status ${xhr.status}):`, xhr.responseText ? xhr.responseText.slice(0, 300) : '');
          if (xhr.status === 502 || xhr.status === 503 || xhr.status === 504 || (xhr.responseText && xhr.responseText.includes('Bad Gateway'))) {
            return reject(new Error('Backend server was restarting. Please try again now.'));
          }
          return reject(
            new Error('Server returned an unexpected response. Please try again.')
          );
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data);
        } else {
          const msg = Array.isArray(data.message)
            ? data.message.join(', ')
            : data.message || 'Something went wrong';
          reject(new Error(msg));
        }
      };

      xhr.onerror = (e) => {
        console.error('XHR Upload Network Error:', e);
        reject(new Error('Network request failed. Please check your connection.'));
      };

      xhr.send(formData);
    } catch (err) {
      reject(err);
    }
  });
}

export function getAttachmentUrl(urlOrPath?: string | null): string | null {
  if (!urlOrPath) return null;
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) {
    return urlOrPath;
  }
  const clean = urlOrPath.startsWith('/') ? urlOrPath : `/${urlOrPath}`;
  if (clean.startsWith('/uploads/')) {
    return `${API_URL}${clean}`;
  }
  return `${API_URL}/uploads${clean}`;
}
