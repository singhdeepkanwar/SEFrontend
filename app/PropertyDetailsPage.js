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
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { getProperties, toggleFavorite, inquireProperty, getInquiries, getAmenities, MEDIA_BASE_URL } from '../services/api';


import AsyncStorage from '@react-native-async-storage/async-storage';
import TutorialOverlay from '../components/TutorialOverlay';

const { width, height } = Dimensions.get('window');

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

  const [allAmenities, setAllAmenities] = useState([]);

  // Tutorial State
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [tutorialSteps, setTutorialSteps] = useState([]);

  // Report Modal
  const [reportModalVisible, setReportModalVisible] = useState(false);

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
    inputRange: [0, 200], // Start moving earlier
    outputRange: [-100, 0], // Move it off-screen (-100) until scroll hits 200, then slide down to 0
    extrapolate: 'clamp',
  });

  const checkFirstTimePropertyUser = async () => {
    try {
      const hasSeen = await AsyncStorage.getItem('has_seen_property_tutorial');
      if (!hasSeen) {
        setTutorialSteps([
          {
            // Correction: Buttons are Share, Save, Report. Container is Right Aligned.
            // Right Edge: W-20. Report: Rightmost. Save: Middle.
            // Report spans: (W-20-44) to (W-20).
            // Save spans: (W-20-44-10-44) to (W-20-44-10).
            // x = W - 118. OK.
            // User requested shift right from 128. Let's try W - 123.
            target: { x: width - 123, y: Platform.OS === 'ios' ? 54 : 20, w: 44, h: 44 }, // Shifted right by 5 pixels
            title: "Save for Later",
            description: "Tap the heart icon to save this property to your favorites list.",
            position: 'bottom'
          },
          {
            target: { x: 24, y: height - (Platform.OS === 'ios' ? 90 : 80), w: width - 48, h: 56 }, // Precise Footer Calc
            title: "Send Inquiry",
            description: "Interested? Tap here to send an inquiry directly to our team.",
            position: 'top'
          }
        ]);
        // Small delay to let page load
        setTimeout(() => setTutorialVisible(true), 1000);
      }
    } catch (e) { console.log('Tutorial check failed', e); }
  };

  const handleTutorialComplete = async () => {
    setTutorialVisible(false);
    await AsyncStorage.setItem('has_seen_property_tutorial', 'true');
  };

  const fetchPropertyDetails = async () => {
    try {
      // Fetch both property info and inquiry status concurrently
      const [propResponse, inquiriesRes, amenitiesRes] = await Promise.all([
        getProperties({ id: id }),
        getInquiries(),
        getAmenities()
      ]);

      let data = propResponse.data;
      if (data.results) data = data.results.find(item => item.id == id) || data.results[0];
      else if (Array.isArray(data)) data = data.find(item => item.id == id) || data[0];

      setProperty(data);
      setIsSaved(!!data.is_favorite);
      setAllAmenities(amenitiesRes.data || []);

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

  useEffect(() => {
    if (id) {
      fetchPropertyDetails();
      checkFirstTimePropertyUser();
    }
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


  const getImageUrl = (imagePath) => {
    if (!imagePath) return require('../assets/images/property_placeholder.jpg');
    if (imagePath.startsWith('http')) return imagePath;
    const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    return `${MEDIA_BASE_URL}${cleanPath}`;
  };

  const handleShare = async () => {
    if (!property) return;
    try {
      const message = `Check out: ${property.title} for ₹${(property.price || 0).toLocaleString('en-IN')}`;
      if (Platform.OS === 'web') {
        if (navigator.share) {
          await navigator.share({
            title: property.title,
            text: message,
            url: window.location.href,
          });
        } else {
          Alert.alert("Share", "Sharing is not supported on this browser. Copy the URL to share!");
        }
      } else {
        await Share.share({
          message: message,
          title: property.title,
        });
      }
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
    setReportModalVisible(true);
  };

  const confirmReport = () => {
    setReportModalVisible(false);
    setTimeout(() => {
      Alert.alert("Reported", "Thank you. We will investigate this listing.");
    }, 300);
  };

  /* REMOVED DUPLICATE confirmReport */

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

  if (loading || !property) return <View style={[styles.container, { justifyContent: 'center' }]}><ActivityIndicator size="large" color="#059669" /></View>;

  return (
    <>
      <Animated.View style={[styles.stickyHeader, { opacity: headerOpacity, transform: [{ translateY: headerTranslate }] }]}>
        <View style={styles.stickyHeaderContent}>
          <TouchableOpacity style={styles.headerCircleButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#059669" />
          </TouchableOpacity>
          <View style={styles.logoContainer}>
            <Image source={require('../assets/images/logo_main.png')} style={{ width: 30, height: 30, marginRight: 8 }} contentFit="contain" />
            <Text style={styles.logoSangrurMini}>Sangrur<Text style={styles.logoEstateMini}>Estate</Text></Text>
          </View>
          <TouchableOpacity style={styles.headerCircleButton} onPress={handleToggleSave}>
            <Ionicons name={isSaved ? "heart" : "heart-outline"} size={22} color={isSaved ? "#ff4d4d" : "#059669"} />
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* Report Modal */}
      <Modal visible={reportModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalBackground}>
          <View style={{ width: '85%', backgroundColor: '#fff', borderRadius: 24, padding: 24, paddingBottom: 30, alignItems: 'center' }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <Ionicons name="alert-circle" size={32} color="#DC2626" />
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#1a1f36', marginBottom: 8, textAlign: 'center' }}>Report Property?</Text>
            <Text style={{ fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
              Do you want to report this property? Our team will investigate ensuring no false details.
            </Text>
            <View style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
              <TouchableOpacity
                onPress={() => setReportModalVisible(false)}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#f3f4f6', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#4b5563' }}>No, Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmReport}
                style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#DC2626', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Yes, Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
            <TouchableOpacity style={styles.circleButton} onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
            <View style={styles.topRightButtons}>
              <TouchableOpacity style={styles.circleButton} onPress={handleShare}>
                <Ionicons name="share-social-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.circleButton, { marginLeft: 20 }]} onPress={handleToggleSave}>
                <Ionicons name={isSaved ? "heart" : "heart-outline"} size={24} color={isSaved ? "#ff4d4d" : "#fff"} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.circleButton, { marginLeft: 20 }]} onPress={handleReport}>
                <Ionicons name="alert-circle-outline" size={24} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Report Modal */}
          <Modal visible={reportModalVisible} transparent={true} animationType="fade">
            <View style={styles.modalBackground}>
              <View style={{ width: '85%', backgroundColor: '#fff', borderRadius: 24, padding: 24, paddingBottom: 30, alignItems: 'center' }}>
                <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                  <Ionicons name="alert-circle" size={32} color="#DC2626" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '700', color: '#1a1f36', marginBottom: 8, textAlign: 'center' }}>Report Property?</Text>
                <Text style={{ fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>
                  Do you want to report this property? Our team will investigate ensuring no false details.
                </Text>
                <View style={{ flexDirection: 'row', width: '100%', gap: 12 }}>
                  <TouchableOpacity
                    onPress={() => setReportModalVisible(false)}
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#f3f4f6', alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#4b5563' }}>No, Back</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={confirmReport}
                    style={{ flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#DC2626', alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#fff' }}>Yes, Report</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
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
              <View style={styles.specIconBg}><Ionicons name="expand-outline" size={20} color="#059669" /></View>
              <View>
                <Text style={styles.specVal}>{property.area} {property.unit}</Text>
                <Text style={styles.specLab}>Total Area</Text>
              </View>
            </View>
          </View>

          {property.property_type === 'HOUSE' && (
            <View style={[styles.premiumSpecsContainer, { marginTop: 12 }]}>
              <View style={styles.premiumSpec}>
                <View style={styles.specIconBg}><Ionicons name="bed-outline" size={20} color="#059669" /></View>
                <View>
                  <Text style={styles.specVal}>{property.bedrooms} Beds</Text>
                  <Text style={styles.specLab}>High Comfort</Text>
                </View>
              </View>
              <View style={styles.specDivider} />
              <View style={styles.premiumSpec}>
                <View style={styles.specIconBg}><Ionicons name="water-outline" size={20} color="#059669" /></View>
                <View>
                  <Text style={styles.specVal}>{property.bathrooms} Baths</Text>
                  <Text style={styles.specLab}>Modern Bath</Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionHeader}>Description</Text>
          <Text style={styles.description}>{property.description}</Text>

          <View style={styles.divider} />

          <Text style={styles.sectionHeader}>Key Features</Text>
          <View style={styles.featuresGrid}>
            {/* Always show Verified Property */}
            <View style={styles.featureItem}>
              <Ionicons name="shield-checkmark-outline" size={24} color="#059669" />
              <Text style={styles.featureText}>Verified Property</Text>
            </View>

            {/* Render dynamic amenities */}
            {property.amenities && property.amenities.length > 0 &&
              property.amenities.map((item) => {
                // Handle both ID (number/string) and Object cases
                const amenity = typeof item === 'object' ? item : allAmenities.find(a => a.id == item);
                if (!amenity) return null;

                // Map backend icon names to MaterialCommunityIcons names
                let iconName = amenity.icon_name || 'sparkles';

                const iconMap = {
                  'bulb': 'lightbulb-on',
                  'parking': 'parking',
                  'chair-rollin': 'chair-rolling',
                  'road-variant': 'road-variant',
                  'cctv': 'cctv',
                  'sofa': 'sofa',
                  'gate': 'gate',
                  'fence': 'fence',
                  'wifi': 'wifi',
                  'water': 'water-pump'
                };

                const finalIcon = iconMap[iconName] || (iconName === 'sparkles' ? 'sparkles' : iconName);

                return (
                  <View key={amenity.id} style={styles.featureItem}>
                    <MaterialCommunityIcons name={finalIcon} size={24} color="#059669" />
                    <Text style={styles.featureText}>{amenity.name}</Text>
                  </View>
                );
              })}
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
                <View style={styles.agentStat}><Text style={[styles.agentStatVal, { fontSize: 13, fontWeight: '600' }]}>Verified Listings Only</Text></View>
                <View style={[styles.agentStatDivider, { height: 16 }]} />
                <View style={styles.agentStat}><Text style={[styles.agentStatVal, { fontSize: 13, fontWeight: '600' }]}>Trusted Local Network</Text></View>
              </View>
            </View>
          </View>

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

      <TutorialOverlay
        visible={tutorialVisible}
        steps={tutorialSteps}
        onComplete={handleTutorialComplete}
      />
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
    zIndex: 100, // Ensure it's above image carousel
    elevation: 10 // Android
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
  specBlockIcon: { fontSize: 24, marginBottom: 8, color: '#059669' },
  specBlockValue: { fontSize: 16, fontWeight: '700', color: '#1a1f36', textAlign: 'center' },
  specBlockLabel: { fontSize: 12, color: '#8890a6', marginTop: 2 },
  mapPlaceholder: { height: 180, backgroundColor: '#eee', borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: Platform.OS === 'ios' ? 34 : 24, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  inquireButton: { backgroundColor: '#059669', height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#059669', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
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
  logoContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, justifyContent: 'center' },
  logoIconBgMini: { width: 26, height: 26, borderRadius: 8, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  logoSangrurMini: { fontSize: 15, fontWeight: '900', color: '#1a1f36', letterSpacing: -0.5 },
  logoEstateMini: { color: '#059669', fontWeight: '400' },
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
    backgroundColor: '#059669',
    padding: 20,
    borderRadius: 24,
    marginTop: 10,
  },
  agentAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#064e3b',
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
    borderColor: '#059669',
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
    color: '#E6FFFA', // Improved contrast on green background
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
    color: '#E6FFFA', // Improved contrast on green background
  },
  agentStatDivider: {
    width: 1,
    height: 15,
    backgroundColor: '#064e3b',
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
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});