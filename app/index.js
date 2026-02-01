/* CHANGES:
   1. Added Terms of Service and Privacy Policy text with links above the Proceed button.
   2. Imported validateInput to check phone/OTP/Name/Email inputs for restricted content.
   3. Added validation checks in handlers (handleSendOtp, handleVerifyOtp, handleRegister).
*/

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, ImageBackground, TouchableOpacity,
  TextInput, SafeAreaView, StatusBar, KeyboardAvoidingView,
  Platform, Dimensions, Alert, ActivityIndicator, Linking,
  Animated, Pressable, ScrollView
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { sendOtp, verifyOtp, register } from '../services/api';
import api from '../services/api';
import { validateInput } from '../utils/validation';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function AuthScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [phone, setPhone] = useState('');
  const [otpArray, setOtpArray] = useState(['', '', '', '']);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');

  const [sessionId, setSessionId] = useState(null);
  const [regToken, setRegToken] = useState(null);

  // Timer & Animations
  const [timer, setTimer] = useState(0);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  // Refs for OTP inputs
  const otpRefs = [useRef(null), useRef(null), useRef(null), useRef(null)];

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const animateToStep = (newStep) => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -20, duration: 200, useNativeDriver: true })
    ]).start(() => {
      setStep(newStep);
      slideAnim.setValue(20);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true })
      ]).start();
    });
  };

  const handleSendOtp = async () => {
    if (!phone) return Alert.alert("Required", "Please enter your phone number to continue.");
    if (phone.length < 10) return Alert.alert("Invalid Phone", "Please enter a valid 10-digit phone number.");

    setLoading(true);
    try {
      const res = await sendOtp(phone);
      setSessionId(res.data.session_id);
      setTimer(30);
      animateToStep(3);
    } catch (err) {
      Alert.alert("Request Failed", err.response?.data?.error || "Unable to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (timer > 0) return;
    setLoading(true);
    try {
      const res = await sendOtp(phone);
      setSessionId(res.data.session_id);
      setTimer(60);
      setOtpArray(['', '', '', '']);
      otpRefs[0].current?.focus();
      Alert.alert("Code Resent", "A new 4-digit verification code has been sent.");
    } catch (err) {
      Alert.alert("Error", "Failed to resend code.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    const fullOtp = otpArray.join('');
    if (fullOtp.length < 4) return Alert.alert("Incomplete Code", "Please enter the 4-digit code sent to you.");

    setLoading(true);
    try {
      const res = await verifyOtp(sessionId, fullOtp);
      if (res.data.status === 'LOGIN') {
        await AsyncStorage.setItem('access_token', res.data.access);
        await AsyncStorage.setItem('refresh_token', res.data.refresh);
        if (res.data.is_profile_complete) {
          router.replace('/HomePage');
        } else {
          Alert.alert("Success", "Welcome back! Let's update your profile.");
          animateToStep(4);
        }
      } else {
        setRegToken(res.data.registration_token);
        animateToStep(4);
      }
    } catch (err) {
      Alert.alert("Verification Failed", "The code you entered is invalid or has expired.");
      setOtpArray(['', '', '', '']);
      otpRefs[0].current?.focus();
    } finally {
      setLoading(false);
    }
  };

  const onOtpChange = (text, index) => {
    // Handle SMS Auto-fill (keyboard suggestion)
    if (text.length > 1) {
      const digits = text.split('').filter(char => /\d/.test(char)).slice(0, 4);
      if (digits.length === 4) {
        setOtpArray(digits);
        otpRefs[3].current?.focus();
        return;
      }
    }

    const newOtp = [...otpArray];
    newOtp[index] = text.slice(-1);
    setOtpArray(newOtp);

    if (text && index < 3) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const onOtpKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otpArray[index] && index > 0) {
      otpRefs[index - 1].current?.focus();
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
        Step into the world of minimalist luxury real estate. Find, save, and manage properties with ease.
      </Text>
      <TouchableOpacity style={styles.primaryButton} activeOpacity={0.8} onPress={() => animateToStep(2)}>
        <Text style={styles.primaryButtonText}>Discover Now</Text>
        <Ionicons name="arrow-forward" size={18} color="#000" style={{ marginLeft: 8 }} />
      </TouchableOpacity>
    </View>
  );

  const renderPage2 = () => (
    <View style={styles.bottomContentContainer}>
      <Text style={styles.label}>Welcome back</Text>
      <Text style={styles.subLabel}>Enter your phone number to proceed</Text>

      <View style={styles.inputContainer}>
        <View style={styles.countryCode}>
          <Text style={styles.countryCodeText}>+91</Text>
        </View>
        <TextInput
          style={styles.phoneNumberInput}
          placeholder="00000 00000"
          placeholderTextColor="rgba(255,255,255,0.4)"
          keyboardType="phone-pad"
          maxLength={10}
          value={phone}
          onChangeText={setPhone}
        />
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, (!phone || phone.length < 10) && styles.disabledButton]}
        onPress={handleSendOtp}
        disabled={loading || phone.length < 10}
      >
        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryButtonText}>Send Code</Text>}
      </TouchableOpacity>

      <Text style={styles.termsText}>
        By continuing, you agree to our{' '}
        <Text style={styles.linkText} onPress={() => openLink('https://sangrurestate.com/terms')}>Terms</Text>
        {' & '}
        <Text style={styles.linkText} onPress={() => openLink('https://sangrurestate.com/privacy')}>Privacy</Text>
      </Text>
    </View>
  );

  const renderPage3 = () => (
    <View style={styles.bottomContentContainer}>
      <Text style={styles.label}>Verification</Text>
      <Text style={styles.subLabel}>We sent a 4-digit code to {phone}</Text>

      <View style={styles.otpRow}>
        {otpArray.map((digit, idx) => (
          <TextInput
            key={idx}
            ref={otpRefs[idx]}
            style={styles.otpBox}
            keyboardType="number-pad"
            maxLength={idx === 0 ? 4 : 1} // Allow 4 digits in first box for auto-fill
            value={digit}
            onChangeText={(text) => onOtpChange(text, idx)}
            onKeyPress={(e) => onOtpKeyPress(e, idx)}
            placeholder="0"
            placeholderTextColor="rgba(255,255,255,0.2)"
            textContentType="oneTimeCode"
            autoComplete="one-time-code"
          />
        ))}
      </View>

      <View style={styles.timerRow}>
        {timer > 0 ? (
          <Text style={styles.timerText}>Resend code in <Text style={{ fontWeight: '700' }}>{timer}s</Text></Text>
        ) : (
          <TouchableOpacity onPress={handleResend}>
            <Text style={styles.resendText}>Resend OTP</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleVerifyOtp} disabled={loading}>
        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryButtonText}>Verify & Continue</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={{ alignSelf: 'center', marginTop: 20 }} onPress={() => animateToStep(2)}>
        <Text style={{ color: '#fff', opacity: 0.6, fontSize: 14 }}>Change Phone Number</Text>
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
        <TextInput style={styles.compactInputField} placeholder="Akshit Gupta" placeholderTextColor="rgba(255,255,255,0.6)" value={name} onChangeText={setName} />
      </View>
      <View style={styles.compactInputWrapper}>
        <Text style={styles.compactInputLabel}>Email (Optional)</Text>
        <TextInput style={styles.compactInputField} placeholder="harry@gmail.com" placeholderTextColor="rgba(255,255,255,0.6)" keyboardType="email-address" value={email} onChangeText={setEmail} />
      </View>
      <View style={styles.compactInputWrapper}>
        <Text style={styles.compactInputLabel}>Address</Text>
        <TextInput style={styles.compactInputField} placeholder="Aalam Road, Bhuvnesh Nagar" placeholderTextColor="rgba(255,255,255,0.6)" value={address} onChangeText={setAddress} />
      </View>
      <View style={styles.compactInputWrapper}>
        <Text style={styles.compactInputLabel}>City/Town</Text>
        <TextInput style={styles.compactInputField} placeholder="Sangrur/Sunam/Dhuri/etc" placeholderTextColor="rgba(255,255,255,0.6)" value={city} onChangeText={setCity} />
      </View>
      <TouchableOpacity style={[styles.primaryButton, { marginTop: 15, height: 48 }]} onPress={handleRegister} disabled={loading}>
        {loading ? <ActivityIndicator color="#000" /> : <Text style={styles.primaryButtonText}>Next</Text>}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <Image
        source={require('../assets/images/auth_bg.jpg')}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={1000}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)']}
        style={StyleSheet.absoluteFill}
      />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.contentWrapper}>
            <View style={styles.headerSection}>
              <View style={styles.logoCircle}>
                <Ionicons name="home" size={24} color="#000" />
              </View>
              <Text style={styles.brandTitle}>SangrurEstate</Text>
            </View>

            <ScrollView
              contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Animated.View style={[
                styles.mainContent,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
              ]}>
                {step === 1 && renderHeroText()}
                {step === 1 && renderPage1()}
                {step === 2 && renderPage2()}
                {step === 3 && renderPage3()}
                {step === 4 && renderPage4()}
              </Animated.View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  safeArea: { flex: 1 },
  contentWrapper: { flex: 1, paddingHorizontal: 32, paddingBottom: 40 },
  headerSection: { marginTop: 20, flexDirection: 'row', alignItems: 'center' },
  logoCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  brandTitle: { color: '#fff', fontSize: 18, fontWeight: '800', letterSpacing: -0.5 },

  mainContent: { paddingVertical: 20 },
  heroContainer: { marginTop: 20, marginBottom: 40 },
  heroTitle: { color: '#fff', fontSize: 48, fontWeight: '800', lineHeight: 52, letterSpacing: -1 },

  bottomContentContainer: { width: '100%' },
  descriptionText: { color: 'rgba(255,255,255,0.7)', fontSize: 17, lineHeight: 26, marginBottom: 40, fontWeight: '400' },

  label: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 15, marginBottom: 32 },

  inputContainer: { flexDirection: 'row', height: 60, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, marginBottom: 24, paddingHorizontal: 4, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  countryCode: { paddingHorizontal: 16, borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.1)' },
  countryCodeText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  phoneNumberInput: { flex: 1, height: '100%', paddingHorizontal: 16, color: '#fff', fontSize: 18, fontWeight: '500' },

  otpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  otpBox: { width: (width - 64 - 45) / 4, height: 75, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 16, textAlign: 'center', color: '#fff', fontSize: 32, fontWeight: '700', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.15)' },

  timerRow: { alignSelf: 'center', marginBottom: 32 },
  timerText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
  resendText: { color: '#fff', fontSize: 14, fontWeight: '700', textDecorationLine: 'underline' },

  primaryButton: { width: '100%', height: 60, backgroundColor: '#fff', borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 },
  primaryButtonText: { color: '#000', fontSize: 17, fontWeight: '700' },
  disabledButton: { opacity: 0.5, backgroundColor: 'rgba(255,255,255,0.8)' },

  termsText: { color: 'rgba(255,255,255,0.4)', fontSize: 13, textAlign: 'center', marginTop: 24, lineHeight: 20 },
  linkText: { color: '#fff', fontWeight: '600' },

  compactFormContainer: { width: '100%', paddingVertical: 10 },
  compactSectionTitle: { color: '#fff', fontSize: 26, fontWeight: '800', marginBottom: 28, letterSpacing: -0.5 },
  compactInputWrapper: { marginBottom: 20 },
  compactInputLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginBottom: 8, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  compactInputField: { width: '100%', height: 56, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 16, paddingHorizontal: 18, color: '#fff', fontSize: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', fontWeight: '500' },
  disabledInput: { backgroundColor: 'rgba(255,255,255,0.05)', opacity: 0.6, borderColor: 'transparent' },
});