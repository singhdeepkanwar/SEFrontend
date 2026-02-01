import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';
import { router } from 'expo-router';

import Constants from 'expo-constants';

// Use environment variable if available (set in .env or via EAS)
const PROD_URL = Constants.expoConfig?.extra?.apiUrl || 'https://backend.sangrurestate.com/api';

// 1. Dynamic Host: 10.0.2.2 for Android Emulator, 127.0.0.1 for iOS
const HOST = Platform.OS === 'android' ? '10.0.2.2' : '127.0.0.1';
const DEV_URL = `https://backend.sangrurestate.com/api`;

export const BASE_URL = process.env.EXPO_PUBLIC_API_URL || (process.env.NODE_ENV === 'production' ? PROD_URL : DEV_URL);
export const MEDIA_BASE_URL = BASE_URL.replace('/api', '') + '/';
let REFRESH = null
// --- AXIOS INSTANCE (For simple JSON requests) ---

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('access_token');
    REFRESH = await AsyncStorage.getItem('refresh_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// --- AUTH & GET REQUESTS ---
export const sendOtp = (phone) => api.post('/auth/send-otp/', { phone });
export const verifyOtp = (session_id, otp_code) => api.post('/auth/verify-otp/', { session_id, otp_code });
export const register = (token, profileData) => api.post('/auth/register/', profileData, { headers: { Authorization: `Bearer ${token}` } });
export const getProperties = (params) => api.get('/properties/', { params });
export const toggleFavorite = (id) => api.post(`/properties/${id}/toggle_favorite/`);
export const inquireProperty = (property) => api.post('/inquiries/', { property });
export const logout = async () => {
  const refresh = await AsyncStorage.getItem('refresh_token');
  return api.post('/auth/logout/', { refresh });
};
export const getMyProperties = () => api.get('/properties/my_properties/', { params: { _t: new Date().getTime() } });
export const getFavorites = () => api.get('/properties/favorites/', { params: { _t: new Date().getTime() } });
export const getInquiries = () => api.get('/inquiries/');

// Delete a property
export const deleteProperty = (id) => api.delete(`/properties/${id}/`);

// Update Status (e.g., Mark as Sold)
export const updatePropertyStatus = (id, status) => api.patch(`/properties/${id}/`, { status });


// --- FILE UPLOAD FUNCTIONS (Using Fetch) ---

// Helper function to handle Fetch logic
const uploadWithFetch = async (url, method, formData) => {
  const token = await AsyncStorage.getItem('access_token');

  console.log(`Uploading to: ${url}`); // Debug Log

  const response = await fetch(url, {
    method: method,
    headers: {
      'Authorization': `Bearer ${token}`,
      // NOTE: No Content-Type header. Fetch sets it automatically with boundary.
    },
    body: formData,
  });

  const responseData = await response.json();

  if (!response.ok) {
    console.error("Upload Error Data:", responseData);
    const error = new Error("Upload Failed");
    error.response = { data: responseData, status: response.status };
    throw error;
  }

  if (__DEV__) console.log("Upload Success Response:", responseData);
  return responseData;
};

export const createProperty = async (formData) => {
  // FIX: Use the dynamic BASE_URL variable
  const url = `${BASE_URL}/properties/`;
  return uploadWithFetch(url, 'POST', formData);
};

export const updateProperty = async (id, formData) => {
  // FIX: Use fetch for updates too to avoid boundary issues
  const url = `${BASE_URL}/properties/${id}/`;
  return uploadWithFetch(url, 'PATCH', formData);
};
api.interceptors.response.use(
  (response) => {
    // If the response is good, just pass it through
    return response;
  },
  async (error) => {
    // Check if the error is a 401 Unauthorized
    if (error.response && error.response.status === 401) {
      console.log("Token expired or invalid. Redirecting to login...");

      // 1. Clear the invalid tokens from storage
      await AsyncStorage.multiRemove(['access_token', 'refresh_token']);

      // 2. Redirect user to the Login/Root screen
      // 'replace' prevents them from hitting the back button to return
      if (router.canGoBack()) {
        router.dismissAll(); // Clear stack if possible
      }
      router.replace('/');

      // 3. Optional: Show a user-friendly alert
      Alert.alert("Session Expired", "Your session has expired. Please log in again.");
    }

    // Return the error so the specific page can handle it too if needed (e.g. stop loading spinners)
    return Promise.reject(error);
  }
);
export default api;