/* CHANGES:
   1. Added "Report Property" button which opens an Alert with options.
   2. Updated translucent buttons to have a darker background for better visibility.
   3. Updated Spec Blocks to align text center/properly for large numbers.
   4. Inquiry button becomes disabled and darkened after click.
*/

import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, ScrollView,
  Dimensions, Share, Alert, Linking, ActivityIndicator, Platform, Modal,
  Animated
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { getProperties, toggleFavorite, inquireProperty, getInquiries, MEDIA_BASE_URL } from '../services/api';

const { width } = Dimensions.get('window');

export default function PropertyDetailsPage() {
  const { id } = useLocalSearchParams();
  const router = useRouter();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [inquired, setInquired] = useState(false);
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const [isModalVisible, setIsModalVisible] = useState(false);

  const mainScrollRef = useRef(null);
  const modalScrollRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Header opacity interpolation
  const headerOpacity = scrollY.interpolate({
    inputRange: [200, 300],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const headerTranslate = scrollY.interpolate({
    inputRange: [0, 300],
    outputRange: [0, -10],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    if (id) fetchPropertyDetails();
  }, [id]);

  // Effect to scroll modal to correct image when it opens
  useEffect(() => {
    if (isModalVisible && modalScrollRef.current && property && property.images && property.images.length > 0) {
      // Ensure the scroll happens after the layout is stable
      setTimeout(() => {
        modalScrollRef.current.scrollTo({ x: modalImageIndex * width, animated: false });
      }, 100);
    }
  }, [isModalVisible, modalImageIndex, property]);


  const fetchPropertyDetails = async () => {
    try {
      // Fetch both property info and inquiry status concurrently
      const [propResponse, inquiriesRes] = await Promise.all([
        getProperties({ id: id }),
        getInquiries()
      ]);

      let data = propResponse.data;
      if (data.results) data = data.results.find(item => item.id == id) || data.results[0];
      else if (Array.isArray(data)) data = data.find(item => item.id == id) || data[0];

      setProperty(data);
      setIsSaved(!!data.is_favorite);

      const alreadyInquired = (inquiriesRes.data || []).some(inq =>
        (inq.property?.id || inq.property) == id
      );
      setInquired(alreadyInquired);

    } catch (error) {
      console.error("Property fetch failed:", error);
      Alert.alert("Error", "Could not load property details.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return require('../assets/images/property_placeholder.jpg');
    if (imagePath.startsWith('http')) return imagePath;
    const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    return `${MEDIA_BASE_URL}${cleanPath}`;
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
    if (inquired || inquiryLoading) return;

    setInquiryLoading(true);
    try {
      await inquireProperty(property.id);
      setInquired(true);
      Alert.alert("Success", "Inquiry sent! The agent will contact you soon.");
    } catch (error) {
      Alert.alert("Error", "Failed to send inquiry.");
    } finally {
      setInquiryLoading(false);
    }
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

  const handleScroll = (event) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
    if (slide !== activeImageIndex) {
      setActiveImageIndex(slide);
    }
  };

  const handleModalScroll = (event) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / event.nativeEvent.layoutMeasurement.width);
    if (slide !== modalImageIndex) {
      setModalImageIndex(slide);
    }
  };

  const openImage = (index) => {
    setModalImageIndex(index);
    setIsModalVisible(true);
    // Use timeout to ensure scroll happens after modal is mounted
    // This timeout is now largely redundant due to the useEffect, but can act as a fallback
    setTimeout(() => {
      if (modalScrollRef.current) {
        modalScrollRef.current.scrollTo({ x: index * width, animated: false });
      }
    }, 50);
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
    <>
      <Animated.View style={[styles.stickyHeader, { opacity: headerOpacity, transform: [{ translateY: headerTranslate }] }]}>
        <View style={styles.stickyHeaderContent}>
          <TouchableOpacity style={styles.headerCircleButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#1a1f36" />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>{property?.title}</Text>
          <TouchableOpacity style={styles.headerCircleButton} onPress={handleToggleSave}>
            <Ionicons name={isSaved ? "heart" : "heart-outline"} size={22} color={isSaved ? "#ff4d4d" : "#1a1f36"} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Animated.ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
      >
        <View style={styles.imageContainer}>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {property.images && property.images.length > 0 ? property.images.map((img, index) => {
              const uri = getImageUrl(img.image || img);
              return (
                <TouchableOpacity key={index} activeOpacity={0.9} onPress={() => openImage(index)}>
                  <Image source={{ uri }} style={styles.image} contentFit="cover" transition={400} />
                </TouchableOpacity>
              );
            }) : (
              <TouchableOpacity activeOpacity={0.9}>
                <Image source={require('../assets/images/property_placeholder.jpg')} style={styles.image} contentFit="cover" transition={400} />
              </TouchableOpacity>
            )}
          </ScrollView>

          {property.images && property.images.length > 1 && (
            <View style={styles.paginationBadge}>
              <Text style={styles.paginationText}>{activeImageIndex + 1} / {property.images.length}</Text>
            </View>
          )}

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
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{property.listing_type === 'RENT' ? 'FOR RENT' : 'FOR SALE'}</Text>
              </View>
              <Text style={styles.title}>{property.title}</Text>
              <View style={styles.addressRow}>
                <Ionicons name="location" size={16} color="#2B8344" />
                <Text style={styles.address}>{property.city}, {property.address}</Text>
              </View>
            </View>
            <View style={styles.priceContainer}>
              <Text style={styles.priceLabel}>{property.listing_type === 'RENT' ? 'PER MONTH' : 'GUIDE PRICE'}</Text>
              <Text style={styles.price}>₹{parseFloat(property.price).toLocaleString('en-IN')}</Text>
            </View>
          </View>

          <View style={styles.premiumSpecsContainer}>
            <View style={styles.premiumSpec}>
              <View style={styles.specIconBg}><Ionicons name="expand-outline" size={20} color="#1a1f36" /></View>
              <View>
                <Text style={styles.specVal}>{property.area} {property.unit}</Text>
                <Text style={styles.specLab}>Total Area</Text>
              </View>
            </View>

            {property.property_type === 'HOUSE' && (
              <>
                <View style={styles.specDivider} />
                <View style={styles.premiumSpec}>
                  <View style={styles.specIconBg}><Ionicons name="bed-outline" size={20} color="#1a1f36" /></View>
                  <View>
                    <Text style={styles.specVal}>{property.bedrooms} Beds</Text>
                    <Text style={styles.specLab}>High Comfort</Text>
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionHeader}>Description</Text>
          <Text style={styles.description}>{property.description}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionHeader}>Key Features</Text>
          <View style={styles.featuresGrid}>
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark-outline" size={24} color="#1a1f36" />
              <Text style={styles.featureText}>Verified Property</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="water-outline" size={24} color="#1a1f36" />
              <Text style={styles.featureText}>Water Supply</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="bulb-outline" size={24} color="#1a1f36" />
              <Text style={styles.featureText}>Electricity</Text>
            </View>
            <View style={styles.featureItem}>
              <Ionicons name="car-outline" size={24} color="#1a1f36" />
              <Text style={styles.featureText}>Parking Space</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionHeader}>Verified Advisor</Text>
          <View style={styles.agentCard}>
            <View style={styles.agentAvatar}>
              <Text style={styles.agentInitials}>SE</Text>
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={14} color="#fff" />
              </View>
            </View>
            <View style={styles.agentInfo}>
              <Text style={styles.agentName}>Sangrur Estate Advisor</Text>
              <Text style={styles.agentTitle}>Certified Property Expert</Text>
              <View style={styles.agentStats}>
                <View style={styles.agentStat}><Text style={styles.agentStatVal}>12+</Text><Text style={styles.agentStatLab}>Exp. Yrs</Text></View>
                <View style={styles.agentStatDivider} />
                <View style={styles.agentStat}><Text style={styles.agentStatVal}>4.9/5</Text><Text style={styles.agentStatLab}>Rating</Text></View>
              </View>
            </View>
          </View>

          <TouchableOpacity style={styles.mapButton} onPress={() => Alert.alert("Opening Maps", "Launching navigation to property location...")}>
            <Ionicons name="map-outline" size={20} color="#1a1f36" />
            <Text style={styles.mapButtonText}>View Location on Map</Text>
          </TouchableOpacity>

          <View style={styles.trustSection}>
            <View style={styles.trustItem}>
              <View style={styles.trustIconCircle}>
                <Ionicons name="sparkles" size={18} color="#2B8344" />
              </View>
              <Text style={styles.trustTitle}>Hassle-Free</Text>
              <Text style={styles.trustSub}>We handle all your paperwork</Text>
            </View>

            <View style={styles.trustDivider} />

            <View style={styles.trustItem}>
              <View style={styles.trustIconCircle}>
                <Ionicons name="document-text" size={18} color="#2B8344" />
              </View>
              <Text style={styles.trustTitle}>Validated</Text>
              <Text style={styles.trustSub}>Complete document set provided</Text>
            </View>

            <View style={styles.trustDivider} />

            <View style={styles.trustItem}>
              <View style={styles.trustIconCircle}>
                <Ionicons name="shield-checkmark" size={18} color="#2B8344" />
              </View>
              <Text style={styles.trustTitle}>Safe Deal</Text>
              <Text style={styles.trustSub}>Secure & verified transactions</Text>
            </View>
          </View>

          <View style={{ height: 120 }} />
        </View>
      </Animated.ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.inquireButton,
            inquired && { backgroundColor: '#2B8344', shadowColor: '#2B8344' },
            inquiryLoading && { opacity: 0.7 }
          ]}
          onPress={handleInquirePress}
          disabled={inquired || inquiryLoading}
        >
          {inquiryLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.inquireButtonText}>{inquired ? 'Inquiry Sent ✓' : 'Inquire Now'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal visible={isModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalBackground}>
          <TouchableOpacity style={styles.closeModal} onPress={() => setIsModalVisible(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>

          <ScrollView
            ref={modalScrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleModalScroll}
            scrollEventThrottle={16}
          >
            {property.images && property.images.length > 0 ? property.images.map((img, index) => (
              <View key={index} style={styles.modalImageWrapper}>
                <Image
                  source={{ uri: getImageUrl(img.image || img) }}
                  style={styles.fullImage}
                  contentFit="contain"
                  transition={200}
                />
              </View>
            )) : (
              <View style={styles.modalImageWrapper}>
                <Image
                  source={require('../assets/images/property_placeholder.jpg')}
                  style={styles.fullImage}
                  contentFit="contain"
                  transition={200}
                />
              </View>
            )}
          </ScrollView>

          {property.images && property.images.length > 1 && (
            <View style={styles.modalPagination}>
              <Text style={styles.paginationText}>{modalImageIndex + 1} / {property.images.length}</Text>
            </View>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scrollView: { flex: 1 },
  imageContainer: { height: 400, width: '100%', position: 'relative' },
  image: { width: width, height: 400 },
  topButtonsContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? Constants.statusBarHeight + 10 : 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    zIndex: 10
  },
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
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 24, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  inquireButton: { backgroundColor: '#1a1f36', height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#1a1f36', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  inquireButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  // --- NEW IMAGE ENHANCEMENTS ---
  paginationBadge: {
    position: 'absolute',
    bottom: 45,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  paginationText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: width,
    height: '100%',
  },
  modalImageWrapper: {
    width: width,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalPagination: {
    position: 'absolute',
    bottom: 50,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  closeModal: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 25,
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeModalText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },

  // --- TRUST SECTION STYLES ---
  trustSection: {
    flexDirection: 'row',
    backgroundColor: '#F8F9FB',
    borderRadius: 20,
    padding: 16,
    marginTop: 30,
    alignItems: 'center',
    justifyContent: 'space-around',
    borderWidth: 1,
    borderColor: '#eee',
  },
  trustItem: {
    flex: 1,
    alignItems: 'center',
  },
  trustIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  trustTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1a1f36',
    marginBottom: 2,
  },
  trustSub: {
    fontSize: 9,
    color: '#5e6c84',
    textAlign: 'center',
    paddingHorizontal: 4,
  },
  trustDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#ddd',
  },

  // --- PREMIUM OVERHAUL STYLES ---
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: Platform.OS === 'ios' ? 100 : 80,
    backgroundColor: '#fff',
    zIndex: 1000,
    paddingTop: Platform.OS === 'ios' ? 40 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  stickyHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    height: 60,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1f36',
    marginHorizontal: 12,
    textAlign: 'center',
  },
  headerCircleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f7f8fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  typeBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2B8344',
    letterSpacing: 0.5,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8890a6',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 24,
  },
  premiumSpecsContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  premiumSpec: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  specIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f7f8fa',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  specVal: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1f36',
  },
  specLab: {
    fontSize: 11,
    color: '#8890a6',
    marginTop: 2,
  },
  specDivider: {
    width: 1,
    height: '100%',
    backgroundColor: '#f0f0f0',
    marginHorizontal: 20,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  featureItem: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f7f8fa',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  featureText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1f36',
    marginLeft: 10,
  },
  agentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1f36',
    padding: 20,
    borderRadius: 24,
    marginTop: 10,
  },
  agentAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#323952',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  agentInitials: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2B8344',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#1a1f36',
  },
  agentInfo: {
    flex: 1,
    marginLeft: 16,
  },
  agentName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  agentTitle: {
    fontSize: 12,
    color: '#8890a6',
    marginTop: 2,
  },
  agentStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  agentStat: {
    alignItems: 'flex-start',
  },
  agentStatVal: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  agentStatLab: {
    fontSize: 10,
    color: '#8890a6',
  },
  agentStatDivider: {
    width: 1,
    height: 15,
    backgroundColor: '#323952',
    marginHorizontal: 15,
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f7f8fa',
    height: 54,
    borderRadius: 16,
    marginTop: 30,
    borderWidth: 1,
    borderColor: '#eee',
  },
  mapButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1f36',
    marginLeft: 10,
  },
});