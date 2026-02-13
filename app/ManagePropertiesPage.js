import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, FlatList, Alert, ActivityIndicator, Platform,
  Animated, ScrollView
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { getMyProperties, updatePropertyStatus, deleteProperty, MEDIA_BASE_URL } from '../services/api';


export default function ManagePropertiesPage() {
  const [myProperties, setMyProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Shimmer animation
  const shimmerValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerValue, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmerValue, { toValue: 0, duration: 1000, useNativeDriver: true })
      ])
    ).start();
  }, []);

  const shimmerOpacity = shimmerValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7]
  });

  const renderSkeletonCard = () => (
    <View style={styles.skeletonCard}>
      <Animated.View style={[styles.skeletonImage, { opacity: shimmerOpacity }]} />
      <View style={{ padding: 15 }}>
        <Animated.View style={[styles.skeletonLine, { width: '60%', opacity: shimmerOpacity }]} />
        <Animated.View style={[styles.skeletonLine, { width: '40%', opacity: shimmerOpacity }]} />
      </View>
    </View>
  );

  useFocusEffect(
    React.useCallback(() => {
      fetchMyProperties();
    }, [])
  );

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
    // Prevent editing if status is PENDING
    if (item.status === 'PENDING') {
      if (Platform.OS === 'web') {
        alert("Please wait till the property is verified to make changes.");
      } else {
        Alert.alert("Action Not Allowed", "Please wait till the property is verified to make changes.");
      }
      return;
    }

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

  const getStatusColor = (status) => {
    switch (status?.toUpperCase()) {
      case 'NEW': return '#4299E1';
      case 'VIEWING': return '#ED8936';
      case 'OFFER': return '#48BB78';
      case 'CLOSED': return '#718096';
      default: return '#059669';
    }
  };

  const getImageUrl = (img) => {
    if (!img) return require('../assets/images/property_placeholder.jpg');
    const path = typeof img === 'string' ? img : img.image;
    if (!path) return require('../assets/images/property_placeholder.jpg');
    if (path.startsWith('http')) return path;
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    return `${MEDIA_BASE_URL}${cleanPath}`;
  };

  const renderStatusPill = (status) => {
    let bg = '#E3F9E5'; let text = '#2B8344'; let label = 'ACTIVE';
    if (status === 'PENDING') { bg = '#FFF4E5'; text = '#B98900'; label = 'PENDING'; }
    if (status === 'SOLD') { bg = '#FEF3F2'; text = '#B42318'; label = 'SOLD'; }
    if (status === 'REJECTED') { bg = '#F2F4F7'; text = '#475467'; label = 'REJECTED'; }
    return (
      <View style={[styles.statusBadge, { backgroundColor: bg }]}>
        <Text style={[styles.statusBadgeText, { color: text }]}>{label}</Text>
      </View>
    );
  };

  const renderPropertyCard = ({ item }) => (
    <View style={styles.card}>
      <TouchableOpacity activeOpacity={0.9} style={styles.cardMain} onPress={() => handleEdit(item)}>
        <View style={styles.imageSection}>
          <Image
            source={{ uri: getImageUrl(item.images && item.images.length > 0 ? item.images[0] : null) }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={300}
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.4)', 'transparent']}
            style={styles.topGradient}
          />
          <View style={styles.cardTopHeader}>
            <View style={styles.propertyTypeRow}>
              <View style={styles.propertyTypeTag}>
                <Text style={styles.propertyTypeTagText}>{item.property_type}</Text>
              </View>
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={10} color="#fff" />
                <Text style={styles.verifiedText}>VERIFIED</Text>
              </View>
            </View>
            {renderStatusPill(item.status)}
          </View>
        </View>

        <View style={styles.contentSection}>
          <View style={styles.priceRow}>
            <Text style={styles.priceValue}>₹{parseFloat(item.price).toLocaleString('en-IN')}</Text>
            <Text style={styles.listingTypeLabel}>{item.listing_type === 'RENT' ? '/ MONTH' : 'GUIDE PRICE'}</Text>
          </View>

          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>

          <View style={styles.addressContainer}>
            <Ionicons name="location-outline" size={14} color="#8890a6" />
            <Text style={styles.address} numberOfLines={1}>{item.city}, {item.address}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statsContainer}>
            {item.property_type === 'HOUSE' && (
              <>
                <View style={styles.statBox}>
                  <Ionicons name="bed-outline" size={16} color="#059669" />
                  <Text style={styles.statLabel}>{item.bedrooms || 0} Beds</Text>
                </View>
                <View style={styles.statBox}>
                  <Ionicons name="water-outline" size={16} color="#059669" />
                  <Text style={styles.statLabel}>{item.bathrooms || 0} Baths</Text>
                </View>
              </>
            )}
            <View style={[styles.statBox, item.property_type !== 'HOUSE' && { flex: 1, justifyContent: 'flex-start' }]}>
              <Ionicons name="expand-outline" size={16} color="#059669" />
              <Text style={styles.statLabel}>{item.area} {item.unit}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.actionRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(item)}>
          <Ionicons name="create-outline" size={18} color="#059669" />
          <Text style={styles.actionBtnText}>Edit</Text>
        </TouchableOpacity>
        <View style={styles.actionDivider} />
        <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(item.id)}>
          <Ionicons name="trash-outline" size={18} color="#FF4D4D" />
          <Text style={[styles.actionBtnText, { color: '#FF4D4D' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1a1f36" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Managed Listings</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => router.push('/ListPropertyPage')}>
          <Ionicons name="add-circle" size={28} color="#059669" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {renderSkeletonCard()}
          {renderSkeletonCard()}
          {renderSkeletonCard()}
        </ScrollView>
      ) : (
        <FlatList
          data={myProperties}
          renderItem={renderPropertyCard}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <Ionicons name="business-outline" size={40} color="#059669" />
              </View>
              <Text style={styles.emptyHeader}>No Listings Yet</Text>
              <Text style={styles.emptySub}>Start sharing your properties with thousands of buyers in Sangrur.</Text>
              <TouchableOpacity style={styles.listNowBtn} onPress={() => router.push('/ListPropertyPage')}>
                <Text style={styles.listNowBtnText}>Post a Property</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FB' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1a1f36', letterSpacing: -0.5 },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },

  listContent: { padding: 20, paddingBottom: 100 },

  card: { backgroundColor: '#fff', borderRadius: 24, marginBottom: 28, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, overflow: 'hidden' },
  cardMain: { width: '100%' },
  imageSection: { height: 220, width: '100%', position: 'relative' },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 80 },
  cardTopHeader: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

  propertyTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  propertyTypeTag: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  propertyTypeTagText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(43, 131, 68, 0.9)',
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)'
  },
  verifiedText: { color: '#fff', fontSize: 8, fontWeight: '900', marginLeft: 4, letterSpacing: 0.5 },
  statusBadge: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 8 },
  statusBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 0.5 },

  contentSection: { padding: 20 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  priceValue: { fontSize: 22, fontWeight: '800', color: '#1a1f36' },
  listingTypeLabel: { fontSize: 11, fontWeight: '700', color: '#8890a6', marginLeft: 8, letterSpacing: 0.5 },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1f36', marginBottom: 6 },
  addressContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  address: { fontSize: 14, color: '#5e6c84', marginLeft: 4, fontWeight: '500' },

  divider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 16 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statBox: { flexDirection: 'row', alignItems: 'center' },
  statLabel: { marginLeft: 6, fontSize: 13, fontWeight: '600', color: '#1a1f36' },

  actionRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingVertical: 14, backgroundColor: '#fff' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  statusToggleBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E3F9E5', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 10 },
  actionBtnText: { marginLeft: 8, fontSize: 13, fontWeight: '700', color: '#1a1f36' },
  actionDivider: { width: 1, height: 24, backgroundColor: '#f0f0f0' },

  skeletonCard: { backgroundColor: '#fff', borderRadius: 24, marginBottom: 28, overflow: 'hidden' },
  skeletonImage: { width: '100%', height: 200, backgroundColor: '#E1E9EE' },
  skeletonLine: { height: 15, backgroundColor: '#E1E9EE', borderRadius: 8, marginTop: 15, marginHorizontal: 20 },

  emptyContainer: { padding: 50, alignItems: 'center', marginTop: 40 },
  emptyIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginBottom: 20, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
  emptyHeader: { fontSize: 20, fontWeight: '800', color: '#1a1f36', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#8890a6', textAlign: 'center', lineHeight: 22, marginBottom: 30 },
  listNowBtn: { paddingVertical: 14, paddingHorizontal: 30, borderRadius: 16, backgroundColor: '#059669' },
  listNowBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});