import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { useRouter, useFocusEffect } from 'expo-router';
import { getInquiries, getProperty, MEDIA_BASE_URL } from '../services/api';

export default function InquiredPropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      fetchInquired();
    }, [])
  );

  const fetchInquired = async () => {
    setLoading(true);
    try {
      const res = await getInquiries();
      const inquiries = res.data.results || res.data || [];

      // Fetch details for each property ID
      const inquiriesWithDetails = await Promise.all(inquiries.map(async (item) => {
        try {
          if (!item.property) return item;
          const propRes = await getProperty(item.property);
          return { ...item, property_obj: propRes.data };
        } catch (err) {
          console.log("Error fetching property detail:", err);
          return item;
        }
      }));

      setProperties(inquiriesWithDetails);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath || typeof imagePath !== 'string') return null;
    if (imagePath.startsWith('http')) return imagePath;
    const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    return `${MEDIA_BASE_URL}${cleanPath}`;
  };

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'NEW': return '#4299E1';
      case 'VIEWING': return '#ED8936';
      case 'OFFER': return '#48BB78';
      case 'CLOSED': return '#718096';
      default: return '#059669';
    }
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>💬</Text>
      <Text style={styles.emptyTitle}>No inquiries yet</Text>
      <Text style={styles.emptySubtitle}>When you inquire about a property, it will show up here.</Text>
      <TouchableOpacity style={styles.exploreBtn} onPress={() => router.replace('/HomePage')}>
        <Text style={styles.exploreBtnText}>Browse Properties</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inquiries</Text>
        <View style={{ width: 44 }} />
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#059669" /></View>
      ) : (
        <FlatList
          data={properties}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={renderEmpty}
          renderItem={({ item }) => {
            const prop = item.property_obj || {};

            // Extract fields based on confirmed JSON structure
            const propId = prop.id || item.property;
            const displayTitle = prop.title || item.property_details || 'Property';
            const displayPrice = parseFloat(prop.price || 0);
            const displayCity = prop.city || 'Sangrur';

            // Image handling: prop.images[0].image
            const firstImage = (prop.images && prop.images.length > 0)
              ? prop.images[0].image
              : null;

            const imageUri = getImageUrl(firstImage);

            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => router.push({ pathname: '/PropertyDetailsPage', params: { id: propId } })}
              >
                <Image
                  source={imageUri ? { uri: imageUri } : require('../assets/images/property_placeholder.jpg')}
                  style={styles.cardImage}
                  contentFit="cover"
                  transition={300}
                />
                <View style={styles.cardContent}>
                  <View style={styles.cardMainInfo}>
                    <View style={styles.cardHeader}>
                      <Text style={styles.propTitle} numberOfLines={1}>{displayTitle}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                        <Text style={styles.statusText}>{item.status}</Text>
                      </View>
                    </View>
                    <Text style={styles.propPrice}>
                      {displayPrice > 0 ? `₹${displayPrice.toLocaleString('en-IN')}` : 'Price on request'}
                    </Text>
                    <Text style={styles.propLocation} numberOfLines={1}>📍 {displayCity}</Text>
                    <Text style={styles.dateText}>Requested on: {new Date(item.created_at).toLocaleDateString()}</Text>

                    {item.admin_remarks && (
                      <View style={styles.remarksContainer}>
                        <Text style={styles.remarksLabel}>Agent Remarks:</Text>
                        <Text style={styles.remarksText}>{item.admin_remarks}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#fff' },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F0F2F5', alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 24, color: '#1a1f36' },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1f36' },
  listContainer: { padding: 20 },
  card: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 20, overflow: 'hidden', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8 },
  cardImage: { width: '100%', height: 180 },
  cardContent: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardMainInfo: { flex: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  propTitle: { fontSize: 18, fontWeight: '700', color: '#1a1f36', flex: 1, marginRight: 10 },
  propPrice: { fontSize: 16, fontWeight: '600', color: '#1a1f36', marginBottom: 4 },
  propLocation: { fontSize: 13, color: '#8890a6', marginBottom: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  dateText: { fontSize: 12, color: '#8890a6', marginBottom: 10 },
  remarksContainer: { marginTop: 10, padding: 12, backgroundColor: '#F7F8FA', borderRadius: 10, borderLeftWidth: 3, borderLeftColor: '#059669' },
  remarksLabel: { fontSize: 12, fontWeight: '700', color: '#059669', marginBottom: 4 },
  remarksText: { fontSize: 13, color: '#5e6c84', lineHeight: 18 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginTop: 100, paddingHorizontal: 40 },
  emptyIcon: { fontSize: 60, marginBottom: 20 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#1a1f36', marginBottom: 8 },
  emptySubtitle: { fontSize: 15, color: '#8890a6', textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  exploreBtn: { backgroundColor: '#059669', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 28 },
  exploreBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' }
});