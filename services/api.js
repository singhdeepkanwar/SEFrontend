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
export const getProperties = (params) => api.get('/properties/', { params: { ...params, _t: new Date().getTime() } });
export const getProperty = (id) => api.get(`/properties/${id}/`, { params: { _t: new Date().getTime() } });
export const toggleFavorite = (id) => api.post(`/properties/${id}/toggle_favorite/`);
export const inquireProperty = (property) => api.post('/inquiries/', { property });
export const logout = async () => {
  const refresh = await AsyncStorage.getItem('refresh_token');
  return api.post('/auth/logout/', { refresh });
};
export const getMyProperties = () => api.get('/properties/my_properties/', { params: { _t: new Date().getTime() } });
export const getFavorites = () => api.get('/properties/favorites/', { params: { _t: new Date().getTime() } });
export const getInquiries = () => api.get('/inquiries/', { params: { _t: new Date().getTime() } });
export const getAmenities = () => api.get('/amenities/', { params: { _t: new Date().getTime() } });

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
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if the error is a 401 Unauthorized and we haven't already retried this request
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem('refresh_token');
        if (!refreshToken) throw new Error("No refresh token");

        // Attempt to refresh the access token
        console.log("Attempting to refresh access token...");
        const response = await axios.post(`${BASE_URL}/auth/token/refresh/`, { refresh: refreshToken });

        if (response.data.access) {
          const newAccessToken = response.data.access;
          await AsyncStorage.setItem('access_token', newAccessToken);

          // Update the original request's authorization header and retry it
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        console.log("Token refresh failed. Redirecting to login...", refreshError);

        // If refresh fails, clear tokens and redirect to login
        await AsyncStorage.multiRemove(['access_token', 'refresh_token']);

        if (router.canGoBack()) {
          router.dismissAll();
        }
        router.replace('/');

        Alert.alert("Session Expired", "Please log in again.");
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
export default api;