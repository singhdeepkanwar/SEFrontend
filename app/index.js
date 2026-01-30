/* CHANGES:
   1. Added Terms of Service and Privacy Policy text with links above the Proceed button.
   2. Imported validateInput to check phone/OTP/Name/Email inputs for restricted content.
   3. Added validation checks in handlers (handleSendOtp, handleVerifyOtp, handleRegister).
*/

import React, { useState } from 'react';
import {
  StyleSheet, Text, View, ImageBackground, TouchableOpacity,
  TextInput, SafeAreaView, StatusBar, KeyboardAvoidingView,
  Platform, Dimensions, Alert, ActivityIndicator, Linking
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendOtp, verifyOtp, register } from '../services/api';
import { validateInput } from '../utils/validation'; // Import validation

const { width, height } = Dimensions.get('window');

export default function AuthScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  const [sessionId, setSessionId] = useState(null);
  const [regToken, setRegToken] = useState(null);

  const handleSendOtp = async () => {
    if (!validateInput(phone, "Phone Number")) return; // Check Input
    if (!phone) return Alert.alert("Error", "Enter phone number");

    setLoading(true);
    try {
      const res = await sendOtp(phone);
      setSessionId(res.data.session_id);
      setStep(3);
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Connection failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!validateInput(otp, "OTP")) return; // Check Input
    if (!otp) return Alert.alert("Error", "Enter OTP");

    setLoading(true);
    try {
      const res = await verifyOtp(sessionId, otp);
      if (res.data.status === 'LOGIN') {
        await AsyncStorage.setItem('access_token', res.data.access);
        await AsyncStorage.setItem('refresh_token', res.data.refresh);
        if (res.data.is_profile_complete) {
          router.replace('/HomePage');
        } else {
          // Keep the access token, but move to profile completion step
          // We'll need to handle the update logic if they are already in the system
          Alert.alert("Welcome Back", "Please complete your profile details.");
          setStep(4);
        }
      } else {
        setRegToken(res.data.registration_token);
        setStep(4);
      }
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    // Check all inputs
    if (!validateInput(name, "Name") || !validateInput(email, "Email") ||
      !validateInput(address, "Address") || !validateInput(city, "City")) return;

    if (!name) return Alert.alert("Error", "Name is required");
    setLoading(true);
    try {
      if (regToken) {
        const res = await register(regToken, { full_name: name, email, city, address });
        await AsyncStorage.setItem('access_token', res.data.access);
        await AsyncStorage.setItem('refresh_token', res.data.refresh);
      } else {
        // Existing user updating profile
        await api.patch('/auth/profile/', { full_name: name, email, city, address });
      }
      Alert.alert("Success", "Profile Updated!");
      router.replace('/HomePage');
    } catch (err) {
      Alert.alert("Error", "Action failed");
    } finally {
      setLoading(false);
    }
  };

  const openLink = (url) => {
    Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
  };

  const renderHeroText = () => (
    <View style={styles.heroContainer}>
      <Text style={styles.heroTitle}>Find the place</Text>
      <Text style={styles.heroTitle}>you'll love</Text>
    </View>
  );

  const renderPage1 = () => (
    <View style={styles.bottomContentContainer}>
      <Text style={styles.descriptionText}>
        Browse, save, and explore homes made for you. Finding your next place has never been easier.
      </Text>
      <TouchableOpacity style={styles.primaryButton} onPress={() => setStep(2)}>
        <Text style={styles.primaryButtonText}>Get Started</Text>
      </TouchableOpacity>
    </View>
  );

  const renderPage2 = () => (
    <View style={styles.bottomContentContainer}>
      <Text style={styles.label}>Enter your phone number</Text>
      <TextInput
        style={styles.inputField}
        placeholder="+91 94176 23112"
        placeholderTextColor="rgba(255,255,255,0.6)"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={setPhone}
      />

      {/* Terms and Privacy Text */}
      <Text style={styles.termsText}>
        By proceeding, you agree to our{' '}
        <Text style={styles.linkText} onPress={() => openLink('https://example.com/terms')}>Terms of Service</Text>
        {' '}and{' '}
        <Text style={styles.linkText} onPress={() => openLink('https://example.com/privacy')}>Privacy Policy</Text>
      </Text>

      <TouchableOpacity style={styles.primaryButton} onPress={handleSendOtp} disabled={loading}>
        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryButtonText}>Proceed</Text>}
      </TouchableOpacity>
    </View>
  );

  const renderPage3 = () => (
    <View style={styles.bottomContentContainer}>
      <Text style={styles.label}>Enter 4-digit code sent to you</Text>
      <TextInput
        style={[styles.inputField, { textAlign: 'center', letterSpacing: 10 }]}
        placeholder="0 0 0 0"
        placeholderTextColor="rgba(255,255,255,0.6)"
        keyboardType="number-pad"
        maxLength={4}
        value={otp}
        onChangeText={setOtp}
      />
      <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyOtp} disabled={loading}>
        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryButtonText}>Proceed</Text>}
      </TouchableOpacity>
    </View>
  );

  const renderPage4 = () => (
    <View style={styles.compactFormContainer}>
      <Text style={styles.compactSectionTitle}>Complete your profile</Text>
      <View style={styles.compactInputWrapper}>
        <Text style={styles.compactInputLabel}>Phone Number</Text>
        <TextInput style={[styles.compactInputField, styles.disabledInput]} value={phone} editable={false} />
      </View>
      <View style={styles.compactInputWrapper}>
        <Text style={styles.compactInputLabel}>Full Name</Text>
        <TextInput style={styles.compactInputField} placeholder="John Doe" placeholderTextColor="rgba(255,255,255,0.6)" value={name} onChangeText={setName} />
      </View>
      <View style={styles.compactInputWrapper}>
        <Text style={styles.compactInputLabel}>Email (Optional)</Text>
        <TextInput style={styles.compactInputField} placeholder="john@example.com" placeholderTextColor="rgba(255,255,255,0.6)" keyboardType="email-address" value={email} onChangeText={setEmail} />
      </View>
      <View style={styles.compactInputWrapper}>
        <Text style={styles.compactInputLabel}>Address (Optional)</Text>
        <TextInput style={styles.compactInputField} placeholder="Street 123" placeholderTextColor="rgba(255,255,255,0.6)" value={address} onChangeText={setAddress} />
      </View>
      <View style={styles.compactInputWrapper}>
        <Text style={styles.compactInputLabel}>City (Optional)</Text>
        <TextInput style={styles.compactInputField} placeholder="New York" placeholderTextColor="rgba(255,255,255,0.6)" value={city} onChangeText={setCity} />
      </View>
      <TouchableOpacity style={[styles.primaryButton, { marginTop: 15, height: 48 }]} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryButtonText}>Next</Text>}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ImageBackground source={{ uri: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80' }} style={styles.backgroundImage} resizeMode="cover">
        <View style={styles.overlay}>
          <SafeAreaView style={styles.safeArea}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
              <View style={styles.contentWrapper}>
                <View>{renderHeroText()}</View>
                {step === 1 && renderPage1()}
                {step === 2 && renderPage2()}
                {step === 3 && renderPage3()}
                {step === 4 && (<View style={styles.expandedContentContainer}>{renderPage4()}</View>)}
              </View>
            </KeyboardAvoidingView>
          </SafeAreaView>
        </View>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundImage: { flex: 1, width: '100%', height: '100%' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  safeArea: { flex: 1 },
  contentWrapper: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between', paddingTop: 20, paddingBottom: 40 },
  heroContainer: { marginTop: 60 },
  heroTitle: { color: '#fff', fontSize: 42, fontWeight: '700', lineHeight: 48 },
  bottomContentContainer: { width: '100%', marginBottom: 20 },
  expandedContentContainer: { marginTop: 20, flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', borderTopLeftRadius: 30, borderTopRightRadius: 30, marginHorizontal: -24, paddingHorizontal: 24, paddingTop: 20, justifyContent: 'flex-start' },
  descriptionText: { color: '#eee', fontSize: 16, lineHeight: 24, marginBottom: 30, textAlign: 'left' },
  label: { color: '#fff', fontSize: 16, marginBottom: 12, marginLeft: 4 },
  inputField: { width: '100%', height: 56, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 16, paddingHorizontal: 20, color: '#fff', fontSize: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  primaryButton: { width: '100%', height: 56, backgroundColor: '#fff', borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginTop: 10 },
  primaryButtonText: { color: '#000', fontSize: 16, fontWeight: '600' },

  // Terms Text Styles
  termsText: { color: 'rgba(255,255,255,0.8)', fontSize: 12, textAlign: 'center', marginBottom: 15, marginTop: 5 },
  linkText: { textDecorationLine: 'underline', fontWeight: 'bold', color: '#fff' },

  compactFormContainer: { width: '100%' },
  compactSectionTitle: { color: '#fff', fontSize: 18, fontWeight: '600', marginBottom: 15 },
  compactInputWrapper: { marginBottom: 10 },
  compactInputLabel: { color: '#ccc', fontSize: 11, marginBottom: 4, marginLeft: 4 },
  compactInputField: { width: '100%', height: 44, backgroundColor: 'rgba(255, 255, 255, 0.2)', borderRadius: 12, paddingHorizontal: 15, color: '#fff', fontSize: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  disabledInput: { backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#aaa', borderColor: 'transparent' },
});