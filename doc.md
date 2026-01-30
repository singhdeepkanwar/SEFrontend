📱 Real Estate App: Frontend Integration Guide
1. Overview
This document outlines the logic required to connect the React Native (Expo) frontend to the Django OTP Authentication backend. The flow is state-driven and follows a 4-step progression.

2. API Service Configuration
Use axios for centralized API management.

CRITICAL: Do not use localhost or 127.0.0.1 for physical device testing. Use your laptop's Local IP.

JavaScript
// services/api.js
import axios from 'axios';

const BASE_URL = 'http://192.168.X.XX:8000/api'; // Replace with your Local IP

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const sendOtp = (phone) => api.post('/auth/send-otp/', { phone });

export const verifyOtp = (session_id, otp_code) => 
  api.post('/auth/verify-otp/', { session_id, otp_code });

export const register = (token, profileData) => 
  api.post('/auth/register/', profileData, {
    headers: { Authorization: `Bearer ${token}` }
  });
3. Authentication Flow Logic
Step 1: Send OTP (Phone Input)

Action: User enters phone number.

API: sendOtp(phone)

Result: Backend returns a session_id.

Transition: Save session_id to state and navigate to OTP screen (setStep(3)).

Step 2: Verify OTP (OTP Input)

Action: User enters 4-digit code.

API: verifyOtp(sessionId, otp)

Branching Logic:

If status === "LOGIN": User is existing. Save JWT Access/Refresh tokens and redirect to Home Screen.

If status === "SIGNUP": User is new. Save the registration_token to state and navigate to Profile Form (setStep(4)).

Step 3: Complete Profile (New Users Only)

Action: User enters Name, Email, Address, City.

API: register(registrationToken, profileData)

Result: Backend creates user and returns final JWT Access/Refresh tokens.

Transition: Save tokens and redirect to Home Screen.

4. State Management Requirements
The frontend must track the following variables:

step: Current UI view (1-4).

loading: Boolean to disable buttons and show ActivityIndicator during requests.

sessionId: String (Required for OTP verification).

regToken: String (Required for the final registration call).

5. Implementation Checklist
Item	Description
Local IP	Ensure api.js uses the laptop's IPv4 address.
Keyboard Type	Use phone-pad for phone input and number-pad for OTP.
Error Handling	Wrap API calls in try/catch and use Alert.alert() for backend errors.
Loading UI	Show a spinner inside the button while loading is true to prevent duplicate requests.
Storage	Use AsyncStorage or Expo SecureStore to persist the final JWT.
6. Troubleshooting
Network Error: Ensure the phone and laptop are on the same Wi-Fi. Check that Django is running on 0.0.0.0:8000.

403 Forbidden: Ensure the registration_token is being passed correctly in the Authorization header as Bearer <token>.