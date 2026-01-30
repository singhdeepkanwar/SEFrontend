import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const useTokenValidation = () => {
  const router = useRouter();

  useEffect(() => {
    const checkToken = async () => {
      const token = await AsyncStorage.getItem('access_token');

      if (!token) {
        // No token? Go to login
        router.replace('/');
        return;
      }

      try {
        // Make a lightweight authenticated call to test the token
        // If this fails with 401, the Interceptor in api.js will handle the redirect automatically!
        await api.get('/auth/profile/'); // Or any protected endpoint
      } catch (error) {
        // Error handling is mostly done by the interceptor, 
        // but you can stop loading indicators here
        console.log("Validation check failed", error);
      }
    };

    checkToken();
  }, []);
};

export default function RootLayout() {
  // Use 'any' cast here to bypass the strict overlap check if TS is being too rigid
  const segments = useSegments() as any;
  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, [segments]);

  useTokenValidation();

  const checkUser = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');

      // In your current structure, the login is at index.js
      // When on index.js, segments[0] usually shows as undefined or is an empty array
      const isAtLogin = !segments[0] || segments[0] === 'index';

      if (token && isAtLogin) {
        // Change '/home' to '/HomePage' to match your filename
        router.replace('/HomePage');
      } else if (!token && segments[0] === 'HomePage') {
        // If no token but trying to view the dashboard, send back to login
        router.replace('/');
      }
    } catch (e) {
      console.error("Failed to fetch token", e);
    }
  };
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="HomePage" />
      <Stack.Screen name="SavedPropertiesPage" />
      <Stack.Screen name="InquiredPropertiesPage" />
    </Stack>
  );
}