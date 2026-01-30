import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  Image, Alert, SafeAreaView, ActivityIndicator, Dimensions
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { getFavorites, toggleFavorite, MEDIA_BASE_URL } from '../services/api';

const { width } = Dimensions.get('window');

export default function SavedPropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      fetchSaved();
    }, [])
  );

  const fetchSaved = async () => {
    setLoading(true);
    try {
      const res = await getFavorites();
      setProperties(res.data || []);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return 'https://via.placeholder.com/400x200';
    return imagePath.startsWith('http') ? imagePath : `${MEDIA_BASE_URL}${imagePath}`;
  };

  const handleUnsave = async (id) => {
    try {
      await toggleFavorite(id);
      setProperties(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      Alert.alert("Error", "Could not remove property from favorites.");
    }
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>❤️</Text>
      <Text style={styles.emptyTitle}>No saved properties</Text>
      <Text style={styles.emptySubtitle}>Start exploring homes and save your favorites here!</Text>
      <TouchableOpacity style={styles.exploreBtn} onPress={() => router.replace('/HomePage')}>
        <Text style={styles.exploreBtnText}>Explore Homes</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Favorites</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#1a1f36" /></View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={renderEmpty}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} onPress={() => router.push({ pathname: '/PropertyDetailsPage', params: { id: item.id } })}>
              <Image source={{ uri: getImageUrl(item.images?.[0]?.image) }} style={styles.cardImage} />
              <View style={styles.cardContent}>
                <View style={styles.cardMainInfo}>
                  <Text style={styles.propTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.propPrice}>₹{parseFloat(item.price).toLocaleString('en-IN')}</Text>
                  <Text style={styles.propLocation} numberOfLines={1}>📍 {item.city}</Text>
                </View>
                <TouchableOpacity onPress={() => handleUnsave(item.id)} style={styles.unsaveBtn}>
                  <Text style={styles.unsaveIcon}>❤️</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff' },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F2F5', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: '#1a1f36' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1f36' },
  listContainer: { padding: 20, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 20, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  cardImage: { width: '100%', height: 200 },
  cardContent: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMainInfo: { flex: 1 },
  propTitle: { fontSize: 18, fontWeight: '700', color: '#1a1f36', marginBottom: 4 },
  propPrice: { fontSize: 16, fontWeight: '600', color: '#1a1f36', marginBottom: 4 },
  propLocation: { fontSize: 13, color: '#8890a6' },
  unsaveBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FFF0F0', alignItems: 'center', justifyContent: 'center' },
  unsaveIcon: { fontSize: 20, color: '#FF4D4D' },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 60, marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#1a1f36', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#8890a6', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  exploreBtn: { backgroundColor: '#1a1f36', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 28 },
  exploreBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});