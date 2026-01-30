/* CHANGES:
   1. Added "Report Property" button which opens an Alert with options.
   2. Updated translucent buttons to have a darker background for better visibility.
   3. Updated Spec Blocks to align text center/properly for large numbers.
   4. Inquiry button becomes disabled and darkened after click.
*/

import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, Image, TouchableOpacity, ScrollView,
  Dimensions, Share, Alert, Linking, ActivityIndicator, Platform
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getProperties, toggleFavorite, inquireProperty, MEDIA_BASE_URL } from '../services/api';

const { width } = Dimensions.get('window');

export default function PropertyDetailsPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [inquired, setInquired] = useState(false); // State for inquiry

  useEffect(() => {
    if (id) fetchPropertyDetails();
  }, [id]);

  const fetchPropertyDetails = async () => {
    try {
      const response = await getProperties({ id: id });
      let data = response.data;
      if (data.results) data = data.results.find(item => item.id == id) || data.results[0];
      else if (Array.isArray(data)) data = data.find(item => item.id == id) || data[0];

      setProperty(data);
      setIsSaved(!!data.is_favorite);
    } catch (error) {
      Alert.alert("Error", "Could not load property details.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return 'https://images.unsplash.com/photo-1587745890135-20db8c79b027';
    return imagePath.startsWith('http') ? imagePath : `${MEDIA_BASE_URL}${imagePath}`;
  };

  const handleShare = async () => {
    if (!property) return;
    try {
      await Share.share({
        message: `Check out: ${property.title} for ₹${(property.price || 0).toLocaleString('en-IN')}`,
        title: property.title,
      });
    } catch (error) { alert(error.message); }
  };

  const handleToggleSave = async () => {
    try {
      const res = await toggleFavorite(property.id);
      setIsSaved(res.data.status === 'favorited');
    } catch (err) { Alert.alert("Login Required", "Please log in to save properties."); }
  };

  const handleInquirePress = async () => {
    if (inquired) return;
    try {
      await inquireProperty(property.id);
      setInquired(true); // Disable button
      Alert.alert("Success", "Inquiry sent! The agent will contact you soon.");
    } catch (error) { Alert.alert("Error", "Failed to send inquiry."); }
  };

  const handleReport = () => {
    Alert.alert(
      "Report Property",
      "Why are you reporting this property?",
      [
        { text: "False Details", onPress: () => Alert.alert("Thank you", "We will investigate this listing.") },
        { text: "Scam/Fraud", onPress: () => Alert.alert("Thank you", "We take fraud seriously and will check this.") },
        { text: "Inappropriate Content", onPress: () => Alert.alert("Thank you", "We will review the content.") },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const renderSpecBlock = (icon, label, value) => (
    <View style={styles.specBlock}>
      <Text style={styles.specBlockIcon}>{icon}</Text>
      <Text style={styles.specBlockValue} numberOfLines={1} adjustsFontSizeToFit>{value || 'N/A'}</Text>
      <Text style={styles.specBlockLabel}>{label}</Text>
    </View>
  );

  if (loading || !property) return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator size="large" color="#1a1f36" /></View>;

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.imageContainer}>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
            {property.images && property.images.length > 0 ? property.images.map((img, index) => (
              <Image key={index} source={{ uri: getImageUrl(img.image || img) }} style={styles.image} resizeMode="cover" />
            )) : <Image source={{ uri: 'https://images.unsplash.com/photo-1587745890135-20db8c79b027' }} style={styles.image} resizeMode="cover" />}
          </ScrollView>

          <View style={styles.topButtonsContainer}>
            <TouchableOpacity style={styles.circleButton} onPress={() => router.back()}><Text style={styles.buttonIcon}>←</Text></TouchableOpacity>
            <View style={styles.topRightButtons}>
              <TouchableOpacity style={styles.circleButton} onPress={handleShare}><Text style={styles.buttonIcon}>↗</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.circleButton, { marginLeft: 10 }]} onPress={handleToggleSave}>
                <Text style={[styles.buttonIcon, isSaved && { color: '#ff4d4d' }]}>{isSaved ? '♥' : '♡'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.circleButton, { marginLeft: 10 }]} onPress={handleReport}>
                <Text style={[styles.buttonIcon, { fontSize: 16 }]}>⚠️</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>{property.title}</Text>
              <Text style={styles.address}>📍 {property.city}, {property.address}</Text>
            </View>
            <Text style={styles.price}>₹{parseFloat(property.price).toLocaleString('en-IN')}</Text>
          </View>

          <Text style={styles.sectionHeader}>Description</Text>
          <Text style={styles.description}>{property.description}</Text>

          <Text style={styles.sectionHeader}>Details</Text>
          <View style={styles.specsRow}>
            {property.property_type === 'HOUSE' && (
              <>{renderSpecBlock('🛏', 'Beds', property.bedrooms)}{renderSpecBlock('🛁', 'Baths', property.bathrooms)}</>
            )}
            {renderSpecBlock('📐', 'Area', `${property.area} ${property.unit}`)}
          </View>

          <Text style={styles.sectionHeader}>Location</Text>
          <View style={styles.mapPlaceholder}>
            <Text style={{ color: '#888' }}>Map View Placeholder</Text>
          </View>
          <View style={{ height: 100 }} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.inquireButton, inquired && { backgroundColor: '#555' }]}
          onPress={handleInquirePress}
          disabled={inquired}
        >
          <Text style={styles.inquireButtonText}>{inquired ? 'Inquired' : 'Inquire Now'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollView: { flex: 1 },
  imageContainer: { height: 400, width: '100%', position: 'relative' },
  image: { width: width, height: 400 },
  topButtonsContainer: { position: 'absolute', top: 50, left: 20, right: 20, flexDirection: 'row', justifyContent: 'space-between', zIndex: 10 },
  topRightButtons: { flexDirection: 'row' },
  // Darker translucent background for better visibility
  circleButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  buttonIcon: { color: '#fff', fontSize: 20 },
  contentContainer: { padding: 24, borderTopLeftRadius: 30, borderTopRightRadius: 30, marginTop: -30, backgroundColor: '#fff' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  title: { fontSize: 26, fontWeight: '700', color: '#1a1f36', marginBottom: 4 },
  address: { fontSize: 14, color: '#8890a6' },
  price: { fontSize: 20, fontWeight: '700', color: '#1a1f36', marginTop: 4 },
  sectionHeader: { fontSize: 18, fontWeight: '600', color: '#1a1f36', marginTop: 24, marginBottom: 12 },
  description: { fontSize: 15, color: '#5e6c84', lineHeight: 24 },
  specsRow: { flexDirection: 'row', justifyContent: 'space-between', width: '100%' },
  // Aligned spec block to center text properly even for large numbers
  specBlock: { flex: 1, backgroundColor: '#F7F8FA', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center', marginHorizontal: 4 },
  specBlockIcon: { fontSize: 24, marginBottom: 8, color: '#1a1f36' },
  specBlockValue: { fontSize: 16, fontWeight: '700', color: '#1a1f36', textAlign: 'center' },
  specBlockLabel: { fontSize: 12, color: '#8890a6', marginTop: 2 },
  mapPlaceholder: { height: 180, backgroundColor: '#eee', borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  inquireButton: { backgroundColor: '#1a1f36', height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#1a1f36', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  inquireButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});