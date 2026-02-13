/* CHANGES:
   1. Updated header profile icon to navigate to '/ProfilePage'.
   2. Removed Saved and Inquired buttons from Sell Dashboard.
   3. Updated Filter Modal: Added 'All Properties' button, 'Clear Filters' button.
   4. Filters now persist in state (which is preserved in React Native memory while app is open unless explicitly cleared).
   5. Darkened the translucent backgrounds of floating icons/buttons for better visibility.
*/

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity,
  StatusBar, FlatList, Modal, TextInput, ScrollView, ActivityIndicator,
  Platform, Alert, TouchableWithoutFeedback, ImageBackground,
  Animated, Dimensions
} from 'react-native';

const { width } = Dimensions.get('window');
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { getProperties, toggleFavorite, MEDIA_BASE_URL } from '../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import TutorialOverlay from '../components/TutorialOverlay';


export default function HomePage() {
  const router = useRouter();
  const [mode, setMode] = useState('buy');
  const [activeFilter, setActiveFilter] = useState('Buy');
  const [modalVisible, setModalVisible] = useState(false);
  const [displayedProperties, setDisplayedProperties] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter States
  const [location, setLocation] = useState('');
  const [propType, setPropType] = useState('');
  const [priceRange, setPriceRange] = useState(null);

  const [pricesEnabled, setPricesEnabled] = useState(false); // For shimmer effect

  // Shimmer & Data Fetching Refs
  const shimmerValue = useRef(new Animated.Value(0)).current;
  const requestIdRef = useRef(0); // Tracks current fetch request to avoid race conditions

  // Tutorial Refs for Dynamic Positioning
  const enquiredBtnRef = useRef(null);
  const buySellRef = useRef(null);
  const searchBarRef = useRef(null);

  // Tutorial State
  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [tutorialSteps, setTutorialSteps] = useState([]);

  useEffect(() => {
    // Small delay to ensure layout is complete before measuring
    const timer = setTimeout(() => {
      checkFirstTimeUser();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const measureElement = (ref) => {
    return new Promise((resolve) => {
      if (ref.current) {
        ref.current.measure((x, y, width, height, pageX, pageY) => {
          resolve({ x: pageX, y: pageY, w: width, h: height });
        });
      } else {
        resolve(null);
      }
    });
  };

  const checkFirstTimeUser = async () => {
    try {
      const hasSeen = await AsyncStorage.getItem('has_seen_tutorial');
      if (!hasSeen) {

        // Measure all elements dynamically
        const enquiredLayout = await measureElement(enquiredBtnRef);
        const buySellLayout = await measureElement(buySellRef);
        const searchLayout = await measureElement(searchBarRef);

        const steps = [];

        if (enquiredLayout) {
          steps.push({
            target: enquiredLayout,
            title: "Check Inquiries",
            description: "Access all your property inquiries and chats here.",
            position: 'bottom'
          });
        }

        if (buySellLayout) {
          steps.push({
            target: buySellLayout,
            title: "Buy & Sell Modes",
            description: "Switch between buying and selling properties easily.",
            position: 'bottom'
          });
        }

        if (searchLayout) {
          steps.push({
            target: searchLayout,
            title: "Search Properties",
            description: "Find your dream home by searching for locations or keywords.",
            position: 'bottom'
          });
        }

        if (steps.length > 0) {
          setTutorialSteps(steps);
          setTutorialVisible(true);
        }
      }
    } catch (e) {
      console.log("Tutorial check failed", e);
    }
  };

  const handleTutorialComplete = async () => {
    setTutorialVisible(false);
    await AsyncStorage.setItem('has_seen_tutorial', 'true');
  };

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
        <Animated.View style={[styles.skeletonTitle, { opacity: shimmerOpacity }]} />
        <Animated.View style={[styles.skeletonAddress, { opacity: shimmerOpacity }]} />
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 15 }}>
          <Animated.View style={[styles.skeletonStat, { opacity: shimmerOpacity }]} />
          <Animated.View style={[styles.skeletonStat, { opacity: shimmerOpacity }]} />
        </View>
      </View>
    </View>
  );

  // Debounced search trigger (Including mode to ensure fresh fetch when switching back to Buy)
  useEffect(() => {
    if (mode === 'buy') {
      const timer = setTimeout(() => {
        fetchLiveProperties();
      }, 400); // Slightly faster debounce
      return () => clearTimeout(timer);
    }
  }, [activeFilter, propType, priceRange, location, mode]);

  useFocusEffect(
    React.useCallback(() => {
      fetchLiveProperties();
    }, [])
  );

  const fetchLiveProperties = async (isManual = false) => {
    const currentRequestId = ++requestIdRef.current;

    if (isManual) setIsRefreshing(true);
    setLoading(true);

    try {
      const params = {
        listing_type: activeFilter === 'Buy' ? 'SALE' : 'RENT',
        search: location || undefined,
        property_type: propType && propType !== 'ALL' ? propType.toUpperCase() : undefined,
        ordering: '-id'
      };

      if (priceRange === '< 50 Lac') params.price__lte = 5000000;
      else if (priceRange === '50 Lac - 1 Cr') { params.price__gte = 5000000; params.price__lte = 10000000; }
      else if (priceRange === '1 - 3 Cr') { params.price__gte = 10000000; params.price__lte = 30000000; }

      params._t = new Date().getTime();

      const response = await getProperties(params);

      // Verification: Only update state if this is still the most recent request
      if (currentRequestId === requestIdRef.current) {
        const fetchedData = response.data.results || response.data;
        setDisplayedProperties(fetchedData);
      }
    } catch (error) {
      console.error("Fetch Error:", error);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
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
    if (!imagePath) return require('../assets/images/property_placeholder.jpg');
    if (imagePath.startsWith('http')) return imagePath;
    const cleanPath = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    return `${MEDIA_BASE_URL}${cleanPath}`;
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.logoContainer}>
        <Image source={require('../assets/images/logo_main.png')} style={{ width: 40, height: 40, marginRight: 10 }} contentFit="contain" />
        <Text style={styles.logoSangrur}>Sangrur<Text style={styles.logoEstate}>Estate</Text></Text>
      </View>

      <View style={styles.compactModeSwitcher} ref={buySellRef} collapsable={false}>
        <TouchableOpacity
          style={[styles.miniTab, mode === 'buy' && styles.miniTabActive]}
          onPress={() => setMode('buy')}
        >
          <Text style={[styles.miniTabText, mode === 'buy' && styles.miniTabActiveText]}>Buy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.miniTab, mode === 'sell' && styles.miniTabActive]}
          onPress={() => setMode('sell')}
        >
          <Text style={[styles.miniTabText, mode === 'sell' && styles.miniTabActiveText]}>Sell</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        <TouchableOpacity
          onPress={() => router.push('/InquiredPropertiesPage')}
          style={styles.miniAvatarContainer}
          ref={enquiredBtnRef}
          collapsable={false}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={20} color="#1a1f36" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/ProfilePage')} style={styles.miniAvatarContainer}>
          <Image source={require('../assets/images/cool_avatar.png')} style={styles.miniAvatar} contentFit="cover" transition={200} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderSearchSection = () => (
    <View style={styles.compactSearchSection} ref={searchBarRef} collapsable={false}>
      <View style={styles.compactSearchBar}>
        <Ionicons name="search-outline" size={18} color="#8890a6" style={{ marginRight: 10 }} />
        <TextInput
          placeholder="Search location or type..."
          placeholderTextColor="#8890a6"
          style={styles.compactSearchInput}
          value={location}
          onChangeText={setLocation}
        />
        <TouchableOpacity style={styles.miniFilterBtn} onPress={() => setModalVisible(true)}>
          <Ionicons name="options-outline" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderFilterRow = () => (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.filterRow}
      contentContainerStyle={{ paddingHorizontal: 20 }}
    >
      <TouchableOpacity
        style={[styles.catChip, activeFilter === 'Buy' && styles.catChipActive]}
        onPress={() => setActiveFilter('Buy')}
      >
        <Ionicons name="home-outline" size={18} color={activeFilter === 'Buy' ? '#fff' : '#059669'} style={{ marginRight: 8 }} />
        <Text style={[styles.catText, activeFilter === 'Buy' && styles.catTextActive]}>Buy</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.catChip, activeFilter === 'Rent' && styles.catChipActive]}
        onPress={() => setActiveFilter('Rent')}
      >
        <Ionicons name="key-outline" size={18} color={activeFilter === 'Rent' ? '#fff' : '#059669'} style={{ marginRight: 8 }} />
        <Text style={[styles.catText, activeFilter === 'Rent' && styles.catTextActive]}>Rent</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.catChip, propType === 'HOUSE' && styles.catChipActive]}
        onPress={() => setPropType(propType === 'HOUSE' ? '' : 'HOUSE')}
      >
        <Ionicons name="business-outline" size={18} color={propType === 'HOUSE' ? '#fff' : '#059669'} style={{ marginRight: 8 }} />
        <Text style={[styles.catText, propType === 'HOUSE' && styles.catTextActive]}>Houses</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.catChip, propType === 'PLOT' && styles.catChipActive]}
        onPress={() => setPropType(propType === 'PLOT' ? '' : 'PLOT')}
      >
        <Ionicons name="map-outline" size={18} color={propType === 'PLOT' ? '#fff' : '#059669'} style={{ marginRight: 8 }} />
        <Text style={[styles.catText, propType === 'PLOT' && styles.catTextActive]}>Land</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderPropertyCard = ({ item }) => (
    <TouchableOpacity activeOpacity={0.9} style={styles.card} onPress={() => router.push({ pathname: '/PropertyDetailsPage', params: { id: item.id } })}>
      <View style={styles.imageSection}>
        <Image
          source={{ uri: getImageUrl(item.images[0]?.image) }}
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
          <TouchableOpacity style={styles.heartButton} onPress={() => handleToggleFavorite(item)}>
            <Ionicons
              name={item.is_favorite ? "heart" : "heart-outline"}
              size={20}
              color={item.is_favorite ? "#ff4b4b" : "#fff"}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.contentSection}>
        <View style={styles.priceRow}>
          <Text style={styles.priceValue}>₹{parseFloat(item.price).toLocaleString('en-IN')}</Text>
          <Text style={styles.listingTypeLabel}>{item.listing_type === 'RENT' ? '/ MONTH' : 'GUIDE PRICE'}</Text>
        </View>

        <Text style={styles.propertyTitle} numberOfLines={1}>{item.title}</Text>

        <View style={styles.addressLine}>
          <Ionicons name="location-outline" size={14} color="#8890a6" />
          <Text style={styles.addressText} numberOfLines={1}>{item.city}, {item.address}</Text>
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
  );

  const renderSellDashboard = () => (
    <ScrollView style={styles.sellContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.sellHeader}>Seller Dashboard</Text>

      <TouchableOpacity style={styles.sellOptionCard} onPress={() => router.push('/ListPropertyPage')}>
        <View style={styles.sellOptionIconContainer}>
          <Ionicons name="add-circle" size={32} color="#059669" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sellOptionTitle}>List a property</Text>
          <Text style={styles.sellOptionSub}>Post your property for free</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>

      <TouchableOpacity style={styles.sellOptionCard} onPress={() => router.push('/ManagePropertiesPage')}>
        <View style={styles.sellOptionIconContainer}>
          <Ionicons name="layers" size={28} color="#059669" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.sellOptionTitle}>Manage properties</Text>
          <Text style={styles.sellOptionSub}>Edit or remove listings</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>

      <View style={styles.benefitsSectionOpen}>
        <Text style={styles.benefitsHeader}>Why list with Sangrur Estate?</Text>

        <View style={styles.benefitItem}>
          <View style={styles.benefitIconCircle}>
            <Ionicons name="sparkles" size={20} color="#2B8344" />
          </View>
          <View style={styles.benefitContent}>
            <Text style={styles.benefitTitle}>Property at your ease</Text>
            <Text style={styles.benefitText}>We handle all the hassle of listing and inquiries for you.</Text>
          </View>
        </View>

        <View style={styles.benefitItem}>
          <View style={styles.benefitIconCircle}>
            <Ionicons name="document-text" size={20} color="#2B8344" />
          </View>
          <View style={styles.benefitContent}>
            <Text style={styles.benefitTitle}>Full Document Support</Text>
            <Text style={styles.benefitText}>From procurement to validation, we provide a complete set of validated documents.</Text>
          </View>
        </View>

        <View style={styles.benefitItem}>
          <View style={styles.benefitIconCircle}>
            <Ionicons name="shield-checkmark" size={20} color="#2B8344" />
          </View>
          <View style={styles.benefitContent}>
            <Text style={styles.benefitTitle}>Verified Inquiries</Text>
            <Text style={styles.benefitText}>Get genuine inquiries from verified local buyers only.</Text>
          </View>
        </View>

        <View style={styles.benefitItem}>
          <View style={styles.benefitIconCircle}>
            <Ionicons name="trending-up" size={20} color="#2B8344" />
          </View>
          <View style={styles.benefitContent}>
            <Text style={styles.benefitTitle}>Maximum Visibility</Text>
            <Text style={styles.benefitText}>Reach thousands of potential buyers in the Sangrur region.</Text>
          </View>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F9FB" />
      <SafeAreaView style={styles.safeArea}>
        {renderHeader()}
        {mode === 'buy' ? (
          <View style={{ flex: 1 }}>
            {renderSearchSection()}
            <View style={{ height: 65 }}>{renderFilterRow()}</View>
            {loading && displayedProperties.length === 0 ? (
              <ScrollView contentContainerStyle={{ padding: 20 }}>
                {renderSkeletonCard()}
                {renderSkeletonCard()}
                {renderSkeletonCard()}
              </ScrollView>
            ) : (
              <FlatList
                data={displayedProperties}
                renderItem={renderPropertyCard}
                keyExtractor={item => item.id.toString()}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                refreshing={isRefreshing}
                onRefresh={() => fetchLiveProperties(true)}
                ListEmptyComponent={!loading && (
                  <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconBg}>
                      <Ionicons name="search-outline" size={40} color="#059669" />
                    </View>
                    <Text style={styles.emptyHeader}>No Results Found</Text>
                    <Text style={styles.emptySub}>Try adjusting your filters or searching for a different area.</Text>
                    <TouchableOpacity style={styles.resetBtn} onPress={clearFilters}>
                      <Text style={styles.resetBtnText}>Clear all filters</Text>
                    </TouchableOpacity>
                  </View>
                )}
              />
            )}
          </View>
        ) : (
          renderSellDashboard()
        )}
      </SafeAreaView>

      <TutorialOverlay
        visible={tutorialVisible}
        steps={tutorialSteps}
        onComplete={handleTutorialComplete}
      />

      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.indicatorLine} />
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Refine Results</Text>
                <TouchableOpacity style={styles.closeBtn} onPress={() => setModalVisible(false)}>
                  <Ionicons name="close" size={20} color="#059669" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.inputLabel}>Location</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Sangrur, Sunam"
                  placeholderTextColor="#8890a6"
                  value={location}
                  onChangeText={setLocation}
                />

                <View style={{ height: 25 }} />

                <Text style={styles.inputLabel}>Property Type</Text>
                <View style={styles.pillRow}>
                  <TouchableOpacity key="all" style={[styles.pill, propType === '' && styles.pillActive]} onPress={() => setPropType('')}>
                    <Text style={[styles.pillText, propType === '' && styles.pillTextActive]}>All Assets</Text>
                  </TouchableOpacity>
                  {['House', 'Plot', 'Commercial'].map((t) => (
                    <TouchableOpacity key={t} style={[styles.pill, propType === t.toUpperCase() && styles.pillActive]} onPress={() => setPropType(t.toUpperCase())}>
                      <Text style={[styles.pillText, propType === t.toUpperCase() && styles.pillTextActive]}>{t}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ height: 10 }} />

                <Text style={styles.inputLabel}>Budget Selection</Text>
                <View style={styles.pillRow}>
                  {['< 50 Lac', '50 Lac - 1 Cr', '1 - 3 Cr', '3 - 5 Cr', '> 5 Cr'].map((p) => (
                    <TouchableOpacity key={p} style={[styles.pill, priceRange === p && styles.pillActive]} onPress={() => setPriceRange(p)}>
                      <Text style={[styles.pillText, priceRange === p && styles.pillTextActive]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <View style={{ height: 40 }} />
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity style={[styles.clearBtn, { flex: 1 }]} onPress={clearFilters}>
                  <Text style={styles.clearBtnText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.applyBtn, { flex: 2 }]} onPress={() => setModalVisible(false)}>
                  <Text style={styles.applyBtnText}>Show Results</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff'
  },
  logoContainer: { flexDirection: 'row', alignItems: 'center' },
  logoIconBg: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', marginRight: 10, position: 'relative' },
  miniLogoBadge: { position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981', borderWidth: 1, borderColor: '#fff' },
  logoSangrur: { fontSize: 18, fontWeight: '900', color: '#1a1f36', letterSpacing: -0.5 },
  logoEstate: { color: '#059669', fontWeight: '400' },
  compactLogo: { fontSize: 18, fontWeight: '800', color: '#1a1f36', letterSpacing: -0.5 },
  compactModeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F0F2F5',
    borderRadius: 20,
    padding: 3,
    width: 120
  },
  miniTab: { flex: 1, paddingVertical: 6, alignItems: 'center', borderRadius: 18 },
  miniTabActive: { backgroundColor: '#fff', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2 },
  miniTabText: { fontSize: 12, fontWeight: '700', color: '#8890a6' },
  miniTabActiveText: { color: '#1a1f36' },
  miniAvatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#f0f0f0',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff'
  },
  miniAvatar: { width: '100%', height: '100%' },

  compactSearchSection: { paddingHorizontal: 20, marginTop: 5 },
  compactSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FB',
    height: 50,
    borderRadius: 14,
    paddingHorizontal: 15,
    borderWidth: 1.5,
    borderColor: '#eee'
  },
  compactSearchInput: { flex: 1, height: '100%', fontSize: 14, color: '#1a1f36', fontWeight: '500' },
  miniFilterBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center'
  },

  filterRow: { marginTop: 0 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#fff',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#f0f0f0',
    height: 40,
    marginTop: 10
  },
  catChipActive: { backgroundColor: '#059669', borderColor: '#059669' },
  catText: { fontSize: 13, fontWeight: '700', color: '#1a1f36' },
  catTextActive: { color: '#fff' },

  listContent: { padding: 20, paddingBottom: 100 },
  emptyContainer: { padding: 50, alignItems: 'center' },
  emptyText: { color: '#8890a6', fontSize: 14, marginTop: 10, textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 28, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, overflow: 'hidden' },
  imageSection: { height: 240, width: '100%', position: 'relative' },
  topGradient: { position: 'absolute', top: 0, left: 0, right: 0, height: 80 },
  cardTopHeader: { position: 'absolute', top: 16, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  propertyTypeTag: { backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 4, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  propertyTypeTagText: { color: '#fff', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  heartButton: { padding: 4 },
  contentSection: { padding: 20 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  priceLabel: { fontSize: 10, fontWeight: '800', color: '#8890a6', letterSpacing: 1.5 },
  priceValue: { fontSize: 22, fontWeight: '800', color: '#1a1f36' },
  propertyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1f36', marginBottom: 6 },
  addressLine: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  addressText: { fontSize: 14, color: '#5e6c84', marginLeft: 4, fontWeight: '500' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 16 },
  statsContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statBox: { flexDirection: 'row', alignItems: 'center' },
  statLabel: { marginLeft: 6, fontSize: 13, fontWeight: '600', color: '#1a1f36' },
  sellContainer: { flex: 1, paddingHorizontal: 20 },
  sellHeader: { fontSize: 28, fontWeight: '800', color: '#1a1f36', marginBottom: 24, marginTop: 10 },
  sellOptionCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 18, borderRadius: 20, marginBottom: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, borderWidth: 1, borderColor: '#f0f0f0' },
  sellOptionIconContainer: { width: 50, height: 50, borderRadius: 12, backgroundColor: '#F8F9FB', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  sellOptionTitle: { fontSize: 17, fontWeight: '700', color: '#1a1f36' },
  sellOptionSub: { fontSize: 13, color: '#8890a6', marginTop: 3 },
  benefitsSectionOpen: { marginTop: 25, paddingHorizontal: 4 },
  benefitsHeader: { fontSize: 19, fontWeight: '800', color: '#1a1f36', marginBottom: 22 },
  benefitItem: { flexDirection: 'row', marginBottom: 25 },
  benefitIconCircle: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#E8F5E9', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  benefitContent: { flex: 1 },
  benefitTitle: { fontSize: 16, fontWeight: '700', color: '#1a1f36', marginBottom: 4 },
  benefitText: { fontSize: 14, color: '#5e6c84', lineHeight: 21 },

  // --- PREMIUM POLISH STYLES ---
  skeletonCard: { backgroundColor: '#fff', borderRadius: 20, marginBottom: 20, overflow: 'hidden' },
  skeletonImage: { width: '100%', height: 200, backgroundColor: '#E1E9EE' },
  skeletonTitle: { height: 20, width: '70%', backgroundColor: '#E1E9EE', borderRadius: 4, marginBottom: 10 },
  skeletonAddress: { height: 14, width: '40%', backgroundColor: '#E1E9EE', borderRadius: 4 },
  skeletonStat: { height: 30, width: 80, backgroundColor: '#E1E9EE', borderRadius: 8 },

  propertyTypeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
  listingTypeLabel: { fontSize: 10, fontWeight: '700', color: '#8890a6', marginLeft: 6 },

  emptyIconBg: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F0F2F5', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyHeader: { fontSize: 20, fontWeight: '800', color: '#1a1f36', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#8890a6', textAlign: 'center', lineHeight: 22, paddingHorizontal: 40, marginBottom: 24 },
  resetBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, backgroundColor: '#059669' },
  resetBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    height: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  indicatorLine: { width: 40, height: 5, borderRadius: 2.5, backgroundColor: '#E1E4E8', alignSelf: 'center', marginBottom: 15 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1a1f36' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#F0F2F5', alignItems: 'center', justifyContent: 'center' },
  inputLabel: { fontSize: 13, fontWeight: '800', color: '#1a1f36', marginBottom: 12, letterSpacing: 0.5, textTransform: 'uppercase' },
  textInput: {
    backgroundColor: '#F8F9FB',
    height: 54,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#1a1f36',
    borderWidth: 1,
    borderColor: '#f0f0f0'
  },
  pillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  pill: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#f0f0f0'
  },
  pillActive: { backgroundColor: '#059669', borderColor: '#059669' },
  pillText: { fontSize: 14, fontWeight: '600', color: '#8890a6' },
  pillTextActive: { color: '#fff' },
  applyBtn: {
    backgroundColor: '#059669',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  applyBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  clearBtn: { height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#f0f0f0' },
  clearBtnText: { color: '#1a1f36', fontSize: 16, fontWeight: '700' },
});