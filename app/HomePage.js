/* CHANGES:
   1. Updated header profile icon to navigate to '/ProfilePage'.
   2. Removed Saved and Inquired buttons from Sell Dashboard.
   3. Updated Filter Modal: Added 'All Properties' button, 'Clear Filters' button.
   4. Filters now persist in state (which is preserved in React Native memory while app is open unless explicitly cleared).
   5. Darkened the translucent backgrounds of floating icons/buttons for better visibility.
*/

import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, Image, TouchableOpacity, SafeAreaView,
  StatusBar, FlatList, Modal, TextInput, ScrollView, ActivityIndicator,
  ImageBackground, Platform, Alert, TouchableWithoutFeedback
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getProperties, toggleFavorite, MEDIA_BASE_URL } from '../services/api';


export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState('buy');
  const [activeFilter, setActiveFilter] = useState('Buy');
  const [modalVisible, setModalVisible] = useState(false);
  const [displayedProperties, setDisplayedProperties] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filter States
  const [location, setLocation] = useState('');
  const [propType, setPropType] = useState('');
  const [priceRange, setPriceRange] = useState(null);

  useFocusEffect(
    React.useCallback(() => {
      fetchLiveProperties();
    }, [activeFilter, propType, priceRange, location])
  );

  const fetchLiveProperties = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const params = {
        listing_type: activeFilter === 'Buy' ? 'SALE' : 'RENT',
        city: location || undefined,
        property_type: propType && propType !== 'ALL' ? propType.toUpperCase() : undefined,
        ordering: '-id'
      };

      if (priceRange === '< 50 Lac') params.price__lte = 5000000;
      else if (priceRange === '50 Lac - 1 Cr') { params.price__gte = 5000000; params.price__lte = 10000000; }
      else if (priceRange === '1 - 3 Cr') { params.price__gte = 10000000; params.price__lte = 30000000; }

      params._t = new Date().getTime(); // Cache buster

      const response = await getProperties(params);
      const fetchedData = response.data.results || response.data;
      setDisplayedProperties(fetchedData);
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async (item) => {
    try {
      const res = await toggleFavorite(item.id);
      setDisplayedProperties(prev => prev.map(p =>
        p.id === item.id ? { ...p, is_favorite: res.data.status === 'favorited' } : p
      ));
    } catch (err) {
      Alert.alert("Auth Required", "Please login to save your favorite properties.");
    }
  };

  const clearFilters = () => {
    setLocation('');
    setPropType('');
    setPriceRange(null);
    setModalVisible(false);
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return 'https://images.unsplash.com/photo-1587745890135-20db8c79b027';
    if (imagePath.startsWith('http')) return imagePath;
    const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    return `${MEDIA_BASE_URL}${cleanPath}`;
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.logoText}>Sangrur<Text style={styles.logoTextAccent}>Estate</Text></Text>
      </View>
      <View style={styles.headerRight}>
        <View style={styles.toggleContainer}>
          <TouchableOpacity style={[styles.toggleBtn, mode === 'buy' && styles.toggleBtnActive]} onPress={() => setMode('buy')}>
            <Text style={[styles.toggleText, mode === 'buy' && styles.toggleTextActive]}>Buy</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.toggleBtn, mode === 'sell' && styles.toggleBtnActive]} onPress={() => setMode('sell')}>
            <Text style={[styles.toggleText, mode === 'sell' && styles.toggleTextActive]}>Sell</Text>
          </TouchableOpacity>
        </View>
        {/* Profile Navigates to ProfilePage */}
        <TouchableOpacity onPress={() => router.push('/ProfilePage')}>
          <Image source={{ uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=100&q=80' }} style={styles.avatar} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFilterRow = () => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow} contentContainerStyle={{ paddingHorizontal: 20 }}>
      <TouchableOpacity style={[styles.filterChip, activeFilter === 'Buy' && styles.filterChipActive]} onPress={() => setActiveFilter('Buy')}>
        <Text style={[styles.filterText, activeFilter === 'Buy' && styles.filterTextActive]}>Buy</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.filterChip, activeFilter === 'Rent' && styles.filterChipActive]} onPress={() => setActiveFilter('Rent')}>
        <Text style={[styles.filterText, activeFilter === 'Rent' && styles.filterTextActive]}>Rent</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.filterChip} onPress={() => setModalVisible(true)}>
        <Text style={styles.filterText}>All Filters ⚙️</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderPropertyCard = ({ item }) => (
    <TouchableOpacity activeOpacity={0.9} style={styles.card} onPress={() => router.push({ pathname: '/PropertyDetailsPage', params: { id: item.id } })}>
      <ImageBackground source={{ uri: getImageUrl(item.images[0]?.image) }} style={styles.cardImage} imageStyle={{ borderRadius: 20 }}>
        <View style={styles.cardOverlay}>
          <View style={styles.cardHeader}>
            <View style={styles.tagContainer}><Text style={styles.tagText}>{item.property_type}</Text></View>
            {/* Darker translucent button */}
            <TouchableOpacity style={styles.favIcon} onPress={() => handleToggleFavorite(item)}>
              <Text style={{ color: item.is_favorite ? '#ff4b4b' : '#fff', fontSize: 18 }}>
                {item.is_favorite ? '♥' : '♡'}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.cardFooter}>
            <View style={styles.cardInfoRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.cardPrice}>₹{parseFloat(item.price).toLocaleString('en-IN')}</Text>
            </View>
            <Text style={styles.cardAddress}>📍 {item.city}, {item.address}</Text>
            <View style={styles.specsRow}>
              {item.property_type === 'HOUSE' && (
                <>
                  <View style={styles.specItem}><Text style={styles.specText}>🛏 {item.bedrooms || 0}</Text></View>
                  <View style={styles.specItem}><Text style={styles.specText}>🛁 {item.bathrooms || 0}</Text></View>
                </>
              )}
              <View style={styles.specItem}><Text style={styles.specText}>📐 {item.area}{item.unit}</Text></View>
            </View>
          </View>
        </View>
      </ImageBackground>
    </TouchableOpacity>
  );

  const renderSellDashboard = () => (
    <View style={styles.sellContainer}>
      <Text style={styles.sellHeader}>Seller Dashboard</Text>
      <TouchableOpacity style={styles.sellOptionCard} onPress={() => router.push('/ListPropertyPage')}>
        <Text style={styles.sellOptionIcon}>➕</Text>
        <View><Text style={styles.sellOptionTitle}>List a property</Text><Text style={styles.sellOptionSub}>Post your property for free</Text></View>
      </TouchableOpacity>
      <TouchableOpacity style={styles.sellOptionCard} onPress={() => router.push('/ManagePropertiesPage')}>
        <Text style={styles.sellOptionIcon}>📝</Text>
        <View><Text style={styles.sellOptionTitle}>Manage properties</Text><Text style={styles.sellOptionSub}>Edit or remove listings</Text></View>
      </TouchableOpacity>
      {/* Removed Saved & Inquired from here */}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FB" />
      <SafeAreaView style={styles.safeArea}>
        {renderHeader()}
        {mode === 'buy' ? (
          <View style={{ flex: 1 }}>
            <View style={{ height: 60 }}>{renderFilterRow()}</View>
            {loading && displayedProperties.length === 0 ? (
              <ActivityIndicator size="large" color="#1a1f36" style={{ marginTop: 50 }} />
            ) : (
              <FlatList
                data={displayedProperties}
                renderItem={renderPropertyCard}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshing={loading}
                onRefresh={fetchLiveProperties}
              />
            )}
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent}>{renderSellDashboard()}</ScrollView>
        )}
      </SafeAreaView>

      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>All Filters</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={styles.closeBtn}>✕</Text></TouchableOpacity>
              </View>
              <Text style={styles.inputLabel}>Location</Text>
              <TextInput style={styles.textInput} placeholder="Enter City, Locality" value={location} onChangeText={setLocation} />
              <Text style={styles.inputLabel}>Property Type</Text>
              <View style={styles.pillRow}>
                <TouchableOpacity key="all" style={[styles.pill, propType === '' && styles.pillActive]} onPress={() => setPropType('')}>
                  <Text style={[styles.pillText, propType === '' && styles.pillTextActive]}>All Properties</Text>
                </TouchableOpacity>
                {['House', 'Plot', 'Commercial'].map((t) => (
                  <TouchableOpacity key={t} style={[styles.pill, propType === t.toUpperCase() && styles.pillActive]} onPress={() => setPropType(t.toUpperCase())}>
                    <Text style={[styles.pillText, propType === t.toUpperCase() && styles.pillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Price Range</Text>
              <View style={styles.pillRow}>
                {['< 50 Lac', '50 Lac - 1 Cr', '1 - 3 Cr', '3 - 5 Cr', '> 5 Cr'].map((p) => (
                  <TouchableOpacity key={p} style={[styles.pill, priceRange === p && styles.pillActive]} onPress={() => setPriceRange(p)}>
                    <Text style={[styles.pillText, priceRange === p && styles.pillTextActive]}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                <TouchableOpacity style={[styles.applyBtn, { backgroundColor: '#ccc', flex: 1 }]} onPress={clearFilters}>
                  <Text style={styles.applyBtnText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.applyBtn, { flex: 2 }]} onPress={() => setModalVisible(false)}>
                  <Text style={styles.applyBtnText}>Apply Filters</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  safeArea: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#F8F9FB' },
  headerLeft: { flex: 1 },
  logoText: { fontSize: 22, fontWeight: '800', color: '#1a1f36' },
  logoTextAccent: { color: '#8890a6', fontWeight: '400' },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#fff' },
  toggleContainer: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 30, padding: 4, marginRight: 12, elevation: 2 },
  toggleBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20 },
  toggleBtnActive: { backgroundColor: '#1a1f36' },
  toggleText: { fontSize: 14, fontWeight: '600', color: '#888' },
  toggleTextActive: { color: '#fff' },
  filterRow: { paddingVertical: 10 },
  filterChip: { backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 25, marginRight: 10, borderWidth: 1, borderColor: '#eee' },
  filterChipActive: { backgroundColor: '#1a1f36', borderColor: '#1a1f36' },
  filterText: { fontWeight: '600', color: '#555' },
  filterTextActive: { color: '#fff' },
  listContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 40 },
  card: { height: 320, marginBottom: 20, borderRadius: 20, elevation: 5, backgroundColor: '#fff' },
  cardImage: { width: '100%', height: '100%', justifyContent: 'space-between' },
  cardOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: 20, justifyContent: 'space-between', padding: 15 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  tagContainer: { backgroundColor: 'rgba(0,0,0,0.5)', paddingVertical: 6, paddingHorizontal: 14, borderRadius: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  tagText: { color: '#fff', fontWeight: '600' },
  favIcon: { width: 36, height: 36, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardFooter: { backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 16, padding: 15 },
  cardInfoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardTitle: { color: '#fff', fontSize: 18, fontWeight: '700', flex: 1, marginRight: 10 },
  cardPrice: { color: '#fff', fontSize: 16, fontWeight: '700' },
  cardAddress: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 12 },
  specsRow: { flexDirection: 'row', width: '100%', justifyContent: 'flex-start' },
  specItem: { flex: 1, flexDirection: 'row', justifyContent: 'center', marginRight: 5, backgroundColor: 'rgba(255,255,255,0.2)', padding: 6, borderRadius: 8 },
  specText: { color: '#fff', fontSize: 12, fontWeight: '500' },
  sellContainer: { flex: 1 },
  sellHeader: { fontSize: 24, fontWeight: 'bold', color: '#1a1f36', marginBottom: 20 },
  sellOptionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 20, borderRadius: 16, marginBottom: 15, elevation: 3 },
  sellOptionIcon: { fontSize: 24, marginRight: 15, width: 40, textAlign: 'center' },
  sellOptionTitle: { fontSize: 16, fontWeight: '700', color: '#1a1f36' },
  sellOptionSub: { fontSize: 13, color: '#888', marginTop: 2 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 25, height: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#1a1f36' },
  closeBtn: { fontSize: 24, color: '#888' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 10, marginTop: 10 },
  textInput: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 12, fontSize: 16 },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  pill: { borderWidth: 1, borderColor: '#ddd', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 20, marginRight: 10, marginBottom: 10 },
  pillActive: { backgroundColor: '#1a1f36', borderColor: '#1a1f36' },
  pillText: { color: '#555', fontWeight: '500' },
  pillTextActive: { color: '#fff' },
  applyBtn: { backgroundColor: '#1a1f36', padding: 18, borderRadius: 16, alignItems: 'center' },
  applyBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});