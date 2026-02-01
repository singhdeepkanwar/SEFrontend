/* CHANGES:
   1. Updated `onEditProperty` logic to route to `/ListPropertyPage` with `property` object.
   2. Kept the existing cycle logic but ensured the navigation prop is used correctly.
*/

import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList, ImageBackground, Alert, ActivityIndicator, Platform
} from 'react-native';
import { useRouter } from 'expo-router';
import { getMyProperties, updatePropertyStatus, deleteProperty, MEDIA_BASE_URL } from '../services/api';


export default function ManagePropertiesPage() {
  const [myProperties, setMyProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    fetchMyProperties();
  }, []);

  const fetchMyProperties = async () => {
    try {
      const response = await getMyProperties();
      setMyProperties(response.data.results || response.data);
    } catch (error) {
      console.error("Fetch Error:", error);
      Alert.alert("Error", "Could not load your properties.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    // Navigate to ListPropertyPage with params to pre-fill the form
    router.push({
      pathname: '/ListPropertyPage',
      params: { propertyData: JSON.stringify(item) } // Pass as JSON to ensure object transfer
    });
  };

  const handleStatusChange = async (item) => {
    let nextStatus = 'SOLD';
    if (item.status === 'SOLD') nextStatus = 'VERIFIED';
    const oldStatus = item.status;
    setMyProperties(prev => prev.map(p => p.id === item.id ? { ...p, status: nextStatus } : p));
    try {
      await updatePropertyStatus(item.id, nextStatus);
    } catch (error) {
      setMyProperties(prev => prev.map(p => p.id === item.id ? { ...p, status: oldStatus } : p));
      Alert.alert("Error", "Failed to update status.");
    }
  };

  const handleDelete = (id) => {
    Alert.alert(
      "Delete Property", "Are you sure? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await deleteProperty(id);
              setMyProperties(prev => prev.filter(p => p.id !== id));
            } catch (error) {
              console.error("Delete Error:", error);
              Alert.alert("Error", "Could not delete property.");
            }
          }
        }
      ]
    );
  };

  const getImageUrl = (img) => {
    if (!img) return 'https://via.placeholder.com/400';
    if (typeof img === 'string') return img.startsWith('http') ? img : `${MEDIA_BASE_URL}${img}`;
    return img.image ? (img.image.startsWith('http') ? img.image : `${MEDIA_BASE_URL}${img.image}`) : 'https://via.placeholder.com/400';
  };

  const renderStatusPill = (status) => {
    let bg = '#E3F9E5'; let text = '#2B8344'; let label = 'Active';
    if (status === 'PENDING') { bg = '#FFF4E5'; text = '#B98900'; label = 'Pending'; }
    if (status === 'SOLD') { bg = '#FEF3F2'; text = '#B42318'; label = 'Sold'; }
    if (status === 'REJECTED') { bg = '#F2F4F7'; text = '#475467'; label = 'Rejected'; }
    return <View style={[manageStyles.statusPill, { backgroundColor: bg }]}><Text style={[manageStyles.statusText, { color: text }]}>{label}</Text></View>;
  };

  const renderPropertyCard = ({ item }) => (
    <View style={manageStyles.cardWrapper}>
      <TouchableOpacity activeOpacity={0.9} style={manageStyles.card} onPress={() => handleEdit(item)}>
        <ImageBackground
          source={{ uri: getImageUrl(item.images && item.images.length > 0 ? item.images[0] : null) }}
          style={manageStyles.cardImage}
          imageStyle={{ borderRadius: 16 }}
        >
          <View style={manageStyles.cardOverlay}>
            <View style={manageStyles.cardHeader}>
              <View style={manageStyles.tagContainer}><Text style={manageStyles.tagText}>{item.property_type}</Text></View>
              {(item.status === 'VERIFIED' || item.status === 'SOLD') ? (
                <TouchableOpacity onPress={() => handleStatusChange(item)}>{renderStatusPill(item.status)}</TouchableOpacity>
              ) : (renderStatusPill(item.status))}
            </View>
            <View style={manageStyles.cardFooter}>
              <View style={manageStyles.cardInfoRow}>
                <Text style={manageStyles.cardTitle}>{item.title}</Text>
                <Text style={manageStyles.cardPrice}>₹{parseFloat(item.price).toLocaleString('en-IN')}</Text>
              </View>
              <Text style={manageStyles.cardAddress}>📍 {item.address}</Text>
              <Text style={manageStyles.editHint}>Tap to Edit</Text>
            </View>
          </View>
        </ImageBackground>
      </TouchableOpacity>
      <TouchableOpacity style={manageStyles.deleteBtn} onPress={() => handleDelete(item.id)}><Text style={{ fontSize: 18, color: '#fff' }}>🗑</Text></TouchableOpacity>
    </View>
  );

  return (
    <View style={manageStyles.container}>
      <View style={manageStyles.header}>
        <TouchableOpacity onPress={() => router.back()} style={manageStyles.backButton}><Text style={manageStyles.backText}>←</Text></TouchableOpacity>
        <Text style={manageStyles.headerTitle}>Manage My Properties</Text>
        <View style={{ width: 30 }} />
      </View>
      {loading ? <ActivityIndicator size="large" color="#1a1f36" style={{ marginTop: 50 }} /> : (
        <FlatList
          data={myProperties}
          renderItem={renderPropertyCard}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={manageStyles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 50, color: '#888' }}>No properties listed.</Text>}
        />
      )}
    </View>
  );
}

const manageStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  backButton: { padding: 5 },
  backText: { fontSize: 24, color: '#1a1f36' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1f36' },
  listContent: { padding: 20, paddingBottom: 40 },
  cardWrapper: { position: 'relative', marginBottom: 20 },
  card: { height: 260, borderRadius: 16, elevation: 4, backgroundColor: '#fff' },
  cardImage: { width: '100%', height: '100%', justifyContent: 'space-between' },
  cardOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 16, justifyContent: 'space-between', padding: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  tagContainer: { backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  tagText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  statusPill: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#ccc' },
  statusText: { fontWeight: '700', fontSize: 12 },
  cardFooter: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 15 },
  cardInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardPrice: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cardAddress: { color: 'rgba(255,255,255,0.9)', fontSize: 11, marginBottom: 5 },
  editHint: { color: '#FFD700', fontSize: 10, fontWeight: '600', textAlign: 'right', marginTop: 5 },
  deleteBtn: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#ff4d4d',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    zIndex: 999,
  }
});