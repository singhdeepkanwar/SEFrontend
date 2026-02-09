
import React, { useState, useEffect } from 'react';

import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator, ScrollView, TextInput, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api'; // Assuming you have an api.js

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ full_name: '', email: '', city: '', address: '' });

  // Custom Confirmation Modal State
  const [modalVisible, setModalVisible] = useState(false);
  const [modalConfig, setModalConfig] = useState({ title: '', message: '', confirmText: '', onConfirm: () => { }, isDestructive: false });

  const showConfirm = (title, message, confirmText, onConfirm, isDestructive = false) => {
    setModalConfig({ title, message, confirmText, onConfirm, isDestructive });
    setModalVisible(true);
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/auth/profile/');
      setProfile(res.data);
      setFormData({
        full_name: res.data.full_name || '',
        email: res.data.email || '',
        city: res.data.city || '',
        address: res.data.address || '',
      });
    } catch (e) {
      console.log(e);
      setProfile({ full_name: 'User', email: 'user@example.com', phone: 'N/A' });
    }
    finally { setLoading(false); }
  };

  const handleLogout = async () => {
    showConfirm(
      "Logout",
      "Are you sure you want to logout?",
      "Logout",
      async () => {
        try {
          const refresh = await AsyncStorage.getItem('refresh_token');
          if (refresh) {
            await api.post('/auth/logout/', { refresh }).catch(err => console.log("Backend logout bit failed", err));
          }
        } catch (e) { }

        await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
        router.replace('/');
      },
      true // Destructive
    );
  };

  const handleDeleteAccount = () => {
    showConfirm(
      "Delete Account",
      "Are you sure? This is permanent.",
      "Delete",
      () => {
        // Second Check
        setTimeout(() => {
          showConfirm(
            "Final Confirmation",
            "This action cannot be undone. All your data will be lost.",
            "Confirm Delete",
            async () => {
              try {
                await api.delete('/auth/delete-account/');
                await AsyncStorage.multiRemove(['access_token', 'refresh_token']);
                router.replace('/');
              } catch (e) {
                // If error, show simple alert as fallback or use another modal state
                console.log("Delete failed", e);
              }
            },
            true
          );
        }, 300); // Slight delay to allow first modal to close nicely
      },
      true
    );
  };



  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await api.patch('/auth/profile/', formData);
      setProfile(res.data);
      setIsEditing(false);
      Alert.alert("Success", "Profile updated successfully!");
    } catch (e) {
      Alert.alert("Error", "Failed to update profile.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Custom Confirmation Modal */}
      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>{modalConfig.title}</Text>
            <Text style={styles.modalMessage}>{modalConfig.message}</Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setModalVisible(false)}>
                <Text style={styles.modalBtnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnConfirm, modalConfig.isDestructive && styles.modalBtnDestructive]}
                onPress={() => {
                  setModalVisible(false);
                  modalConfig.onConfirm();
                }}
              >
                <Text style={styles.modalBtnConfirmText}>{modalConfig.confirmText}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Text style={styles.backBtn}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 30 }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.profileHeader}>
          <Image source={require('../assets/images/cool_avatar.png')} style={styles.avatar} contentFit="cover" transition={200} />
          {isEditing ? (
            <TextInput
              style={styles.nameInput}
              value={formData.full_name}
              onChangeText={(txt) => setFormData({ ...formData, full_name: txt })}
              placeholder="Full Name"
            />
          ) : (
            <Text style={styles.name}>{profile?.full_name || 'No Name Set'}</Text>
          )}
          <Text style={styles.email}>{profile?.email}</Text>
          <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditing(!isEditing)}>
            <Text style={styles.editBtnText}>{isEditing ? "Cancel" : "Edit Profile"}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Phone</Text>
            <Text style={styles.detailValue}>{profile?.phone}</Text>
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Email</Text>
            {isEditing ? (
              <TextInput
                style={styles.detailInput}
                value={formData.email}
                onChangeText={(txt) => setFormData({ ...formData, email: txt })}
                placeholder="Email"
                keyboardType="email-address"
              />
            ) : (
              <Text style={styles.detailValue}>{profile?.email || 'Not Set'}</Text>
            )}
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>City</Text>
            {isEditing ? (
              <TextInput
                style={styles.detailInput}
                value={formData.city}
                onChangeText={(txt) => setFormData({ ...formData, city: txt })}
                placeholder="City"
              />
            ) : (
              <Text style={styles.detailValue}>{profile?.city || 'Not Set'}</Text>
            )}
          </View>
          <View style={styles.detailItem}>
            <Text style={styles.detailLabel}>Address</Text>
            {isEditing ? (
              <TextInput
                style={styles.detailInput}
                value={formData.address}
                onChangeText={(txt) => setFormData({ ...formData, address: txt })}
                placeholder="Address"
              />
            ) : (
              <Text style={styles.detailValue}>{profile?.address || 'Not Set'}</Text>
            )}
          </View>
          {isEditing && (
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.menu}>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/SavedPropertiesPage')}>
            <Text style={styles.menuText}>❤️ Saved Properties</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/InquiredPropertiesPage')}>
            <Text style={styles.menuText}>💬 Inquired Properties</Text>
            <Text style={styles.arrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
            <Text style={styles.menuText}>🚪 Logout</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]} onPress={handleDeleteAccount}>
            <Text style={[styles.menuText, { color: 'red' }]}>🗑 Delete Account</Text>
          </TouchableOpacity>

        </View>
      </ScrollView >
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  header: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff'
  },
  backBtn: { fontSize: 24, color: '#1a1f36' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1f36' },
  profileHeader: { alignItems: 'center', marginVertical: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 10 },
  name: { fontSize: 22, fontWeight: '700' },
  email: { fontSize: 14, color: '#888', marginBottom: 10 },
  editBtn: { backgroundColor: '#059669', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  editBtnText: { color: '#fff', fontSize: 14 },
  nameInput: { fontSize: 22, fontWeight: '700', borderBottomWidth: 1, borderBottomColor: '#ccc', textAlign: 'center', marginBottom: 5, width: '80%' },
  detailInput: { fontSize: 16, fontWeight: '500', color: '#1a1f36', borderBottomWidth: 1, borderBottomColor: '#eee', paddingVertical: 2 },
  saveBtn: { backgroundColor: '#2B8344', padding: 15, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveBtnText: { color: '#fff', fontWeight: '700' },
  detailsContainer: { backgroundColor: '#fff', marginHorizontal: 20, padding: 20, borderRadius: 16, marginBottom: 10 },
  detailItem: { marginBottom: 15 },
  detailLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  detailValue: { fontSize: 16, fontWeight: '500', color: '#1a1f36' },
  menu: { backgroundColor: '#fff', margin: 20, borderRadius: 16, padding: 10 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  menuText: { fontSize: 16, fontWeight: '500' },
  arrow: { fontSize: 20, color: '#ccc' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '85%', backgroundColor: '#fff', borderRadius: 20, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#1a1f36', marginBottom: 10 },
  modalMessage: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 22 },
  modalButtons: { flexDirection: 'row', width: '100%', gap: 12 },
  modalBtnCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#f0f0f0', alignItems: 'center' },
  modalBtnCancelText: { fontSize: 16, fontWeight: '600', color: '#666' },
  modalBtnConfirm: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#059669', alignItems: 'center' },
  modalBtnDestructive: { backgroundColor: '#dc2626' },
  modalBtnConfirmText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});