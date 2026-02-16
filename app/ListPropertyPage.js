/* CHANGES:
   1. Added validation for content checking using validateInput.
   2. Parsed `propertyData` from params to pre-fill fields in Edit Mode.
   3. Changed Button text to "Save Changes" if editing.
*/

import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Platform,
  Modal, FlatList, Keyboard, KeyboardAvoidingView, TouchableWithoutFeedback
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { createProperty, updateProperty, getAmenities, MEDIA_BASE_URL } from '../services/api';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { validateInput } from '../utils/validation';

export default function ListPropertyPage() {
  const router = useRouter();
  const { propertyData } = useLocalSearchParams();

  const propertyToEdit = propertyData ? JSON.parse(propertyData) : null;
  const isEditMode = !!propertyToEdit;
  const [loading, setLoading] = useState(false);

  // --- PICKER STATE ---
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerType, setPickerType] = useState(null); // 'price' or 'area'

  // --- FORM STATE ---
  const [listingType, setListingType] = useState(propertyToEdit?.listing_type === 'RENT' ? 'rent' : 'sell');
  const [propertyName, setPropertyName] = useState(propertyToEdit?.title || '');
  const [propertyType, setPropertyType] = useState(propertyToEdit?.property_type ?
    (propertyToEdit.property_type.charAt(0) + propertyToEdit.property_type.slice(1).toLowerCase()) : 'House');

  const formatInitialPrice = () => {
    const raw = parseFloat(propertyToEdit?.price);
    if (!raw || isNaN(raw)) return { value: '', unit: (listingType === 'rent' ? 'Thousand' : 'Lakh') };

    // Ensure price is displayed correctly based on unit
    if (raw >= 10000000) return { value: String(raw / 10000000), unit: 'Crore' };
    if (raw >= 100000) return { value: String(raw / 100000), unit: 'Lakh' };
    if (raw >= 1000) return { value: String(raw / 1000), unit: 'Thousand' };
    return { value: String(raw), unit: (listingType === 'rent' ? 'Thousand' : 'Lakh') }; // Default to Lakh for sell, Thousand for rent if small
  };

  const initialPriceInfo = isEditMode ? formatInitialPrice() : { value: '', unit: (listingType === 'rent' ? 'Thousand' : 'Lakh') };
  const [price, setPrice] = useState(initialPriceInfo.value);
  const [priceUnit, setPriceUnit] = useState(initialPriceInfo.unit);

  const [bedrooms, setBedrooms] = useState(propertyToEdit?.bedrooms ? String(propertyToEdit.bedrooms) : '');
  const [bathrooms, setBathrooms] = useState(propertyToEdit?.bathrooms ? String(propertyToEdit.bathrooms) : '');

  const reverseUnitMap = { "SQYD": "Gaj", "SQFT": "Sq. Feet", "MARLA": "Marla", "KANAL": "Kanal", "ACRE": "Acre", "SQMTR": "Sq. Meter" };
  const [area, setArea] = useState(propertyToEdit?.area ? String(propertyToEdit.area) : '');
  const [areaUnit, setAreaUnit] = useState(reverseUnitMap[propertyToEdit?.unit] || propertyToEdit?.unit || 'Gaj');

  const [location, setLocation] = useState(propertyToEdit?.address || '');
  const [city, setCity] = useState(propertyToEdit?.city || 'Sangrur');
  const [description, setDescription] = useState(propertyToEdit?.description || '');
  const [amenities, setAmenities] = useState(
    (propertyToEdit?.amenities || []).map(item => typeof item === 'object' ? item.id : item)
  );
  const [allAmenities, setAllAmenities] = useState([]);
  const [amenitiesLoading, setAmenitiesLoading] = useState(false);

  const [errors, setErrors] = useState({});

  // Initialize images with existing ones if in edit mode
  // Initialize images as objects with metadata
  const initialImages = propertyToEdit?.images?.map(img => {
    const id = typeof img === 'object' ? img.id : null;
    const path = typeof img === 'string' ? img : img.image;
    if (!path) return null;
    const uri = path.startsWith('http') ? path : `${MEDIA_BASE_URL}${path.startsWith('/') ? path.slice(1) : path}`;
    return { id, uri, isNew: false };
  }).filter(Boolean) || [];

  const [images, setImages] = useState(initialImages); // Array of { id, uri, isNew }
  const [deletedImageIds, setDeletedImageIds] = useState([]); // Array of IDs to delete on backend

  const areaUnits = ["Gaj", "Sq. Yard", "Marla", "Kanal", "Acre", "Sq. Feet", "Sq. Meter"];
  const sellPriceUnits = ["Lakh", "Crore"];
  const rentPriceUnits = ["Thousand", "Lakh"];

  useEffect(() => {
    fetchAmenities();
  }, []);

  const fetchAmenities = async () => {
    setAmenitiesLoading(true);
    try {
      const res = await getAmenities();
      setAllAmenities(res.data || []);
    } catch (error) {
      console.error("Failed to fetch amenities:", error);
    } finally {
      setAmenitiesLoading(false);
    }
  };

  useEffect(() => {
    if (!isEditMode) {
      if (listingType === 'sell') setPriceUnit('Lakh');
      else setPriceUnit('Thousand');
    }
  }, [listingType]);

  const getRawPrice = () => {
    const p = parseFloat(price);
    if (isNaN(p)) return 0;
    if (priceUnit === 'Thousand') return p * 1000;
    if (priceUnit === 'Lakh') return p * 100000;
    if (priceUnit === 'Crore') return p * 10000000;
    return p;
  };

  const handleAddImage = async () => {
    if (images.length >= 12) {
      Alert.alert("Limit Reached", "You can upload a maximum of 12 images.");
      return;
    }
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow access to your photos to upload images.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled) {
      setImages([...images, { uri: result.assets[0].uri, isNew: true }]);
    }
  };

  const handleRemoveImage = (indexToRemove) => {
    const removedImage = images[indexToRemove];
    if (!removedImage.isNew && removedImage.id) {
      setDeletedImageIds([...deletedImageIds, removedImage.id]);
    }
    setImages(images.filter((_, index) => index !== indexToRemove));
  };

  const handlePostProperty = async () => {
    // Reset errors
    setErrors({});
    const newErrors = {};

    // Validation
    if (!propertyName.trim()) newErrors.propertyName = "Property Title is required";
    if (!description.trim()) newErrors.description = "Please provide a description";
    // ... existing logs ...

    // Content Safety Validation
    if (!validateInput(propertyName, "Property Name") || !validateInput(description, "Description") || !validateInput(location, "Location") || !validateInput(city, "City")) return;

    setLoading(true);
    try {
      const formData = new FormData();
      const unitMap = { "Gaj": "SQYD", "Sq. Yard": "SQYD", "Sq. Feet": "SQFT", "Marla": "MARLA", "Kanal": "KANAL", "Acre": "ACRE", "Sq. Meter": "SQMTR" };

      const unit = unitMap[areaUnit] || (Object.values(unitMap).includes(areaUnit) ? areaUnit : 'SQFT');

      const changedKeys = [];
      const appendIfChanged = (key, value, originalValue, isNumber = false) => {
        let hasChanged = false;
        if (!isEditMode) hasChanged = true;
        else if (isNumber) {
          hasChanged = parseFloat(value) !== parseFloat(originalValue);
        } else {
          hasChanged = String(value) !== String(originalValue || '');
        }

        if (hasChanged) {
          formData.append(key, value);
          changedKeys.push(key);
        }
      };

      appendIfChanged('title', propertyName, propertyToEdit?.title);
      // Compare price as numbers for safety
      if (!isEditMode || getRawPrice() !== parseFloat(propertyToEdit?.price)) {
        formData.append('price', getRawPrice());
        changedKeys.push('price');
      }
      appendIfChanged('description', description, propertyToEdit?.description);
      appendIfChanged('address', location, propertyToEdit?.address);
      appendIfChanged('city', city, propertyToEdit?.city);

      const backendListingType = listingType === 'sell' ? 'SALE' : 'RENT';
      appendIfChanged('listing_type', backendListingType, propertyToEdit?.listing_type);

      const backendPropType = propertyType.toUpperCase();
      appendIfChanged('property_type', backendPropType, propertyToEdit?.property_type);

      // Use numeric comparison for Area
      appendIfChanged('area', area, propertyToEdit?.area, true);
      appendIfChanged('unit', unit, propertyToEdit?.unit);

      if (propertyType === 'House') {
        appendIfChanged('bedrooms', bedrooms, propertyToEdit?.bedrooms);
        appendIfChanged('bathrooms', bathrooms, propertyToEdit?.bathrooms);
      }

      // Handle amenities: Check if changed.
      const normalizedNewAmenities = amenities.map(item => typeof item === 'object' ? item.id : item);
      const oldAmenities = (propertyToEdit?.amenities || [])
        .map(item => String(typeof item === 'object' ? item.id : item))
        .sort().join(',');
      const newAmenities = normalizedNewAmenities.map(String).sort().join(',');

      if (__DEV__) {
        console.log("Amenities to send:", normalizedNewAmenities);
      }

      if (!isEditMode || oldAmenities !== newAmenities) {
        // DRF Handle multiple fields with the same name for ListField
        // Using 'amenities' or 'amenities[]' - 'amenities' is standard for DRF
        // but 'amenities[]' is safer for some middleware.
        if (normalizedNewAmenities.length > 0) {
          normalizedNewAmenities.forEach(id => {
            formData.append('amenities', id);
          });
          changedKeys.push('amenities');
        } else if (isEditMode) {
          // Omit appending if empty to avoid type errors in DRF multipart
          changedKeys.push('amenities');
        }
      }

      const newImages = images.filter(img => img.isNew);
      const hasImagesChange = newImages.length > 0 || deletedImageIds.length > 0;



      if (isEditMode && changedKeys.length === 0 && !hasImagesChange) {
        if (Platform.OS === 'web') {
          alert("No changes were made. Redirecting...");
          window.location.href = "/ManagePropertiesPage";
        } else {
          Alert.alert("No Changes", "You haven't made any changes.", [
            { text: "OK", onPress: () => router.back() }
          ]);
        }
        setLoading(false);
        return;
      }

      if (__DEV__) {
        console.log("OPTIMIZED REQUEST REPORT:");
        console.log(`Sending ONLY these fields: ${JSON.stringify(changedKeys)}`);
        if (newImages.length > 0) console.log(`Adding ${newImages.length} new images`);
        if (deletedImageIds.length > 0) console.log(`Deleting images: ${deletedImageIds}`);
        console.log("------------------------------------------------");
      }

      if (isEditMode) {
        // Only upload NEW images
        const newImages = images.filter(img => img.isNew);

        await Promise.all(newImages.map(async (imgObj, idx) => {
          const imgUri = imgObj.uri;
          const filename = `photo_${new Date().getTime()}_${idx}.jpg`;
          const type = 'image/jpeg';
          if (Platform.OS === 'web') {
            const response = await fetch(imgUri);
            const blob = await response.blob();
            formData.append('uploaded_images', blob, filename);
          } else {
            formData.append('uploaded_images', { uri: imgUri, name: filename, type: type });
          }
        }));

        // Send IDs of images to delete
        if (deletedImageIds.length > 0) {
          // Try sending as a comma-separated string (common fix for RN FormData issues)
          // Backend Spec says int[], but multipart lists can be tricky.
          // If this fails, next step is delete_images[] key.
          formData.append('delete_images', deletedImageIds.join(','));
        }

        await updateProperty(propertyToEdit.id, formData);
      } else {
        await Promise.all(images.map(async (imgObj, idx) => {
          const imgUri = imgObj.uri;
          const filename = `photo_${new Date().getTime()}_${idx}.jpg`;
          const type = 'image/jpeg';
          if (Platform.OS === 'web') {
            const response = await fetch(imgUri);
            const blob = await response.blob();
            formData.append('uploaded_images', blob, filename);
          } else {
            formData.append('uploaded_images', { uri: imgUri, name: filename, type: type });
          }
        }));
        await createProperty(formData);
      }



      if (Platform.OS === 'web') {
        console.log("Web platform detected. Success. Redirecting...");
        alert(isEditMode ? "Property Updated! Redirecting..." : "Property Listed! Redirecting...");
        // Force full page reload to ensure data freshness
        window.location.href = "/ManagePropertiesPage";
      } else {
        Alert.alert("Success", isEditMode ? "Property Updated!" : "Property Listed!", [
          { text: "OK", onPress: () => router.back() }
        ]);
      }
    } catch (error) {
      console.error("Submission Error:", error);
      let errorMessage = "Failed to save property.";

      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = "This property no longer exists. It may have been deleted.";
        } else if (error.response.data && error.response.data.detail) {
          errorMessage = error.response.data.detail;
        }
      }

      if (Platform.OS === 'web') {
        alert("Error: " + errorMessage);
        if (error.response && error.response.status === 404) {
          window.location.href = "/ManagePropertiesPage"; // Redirect back if not found
        }
      } else {
        Alert.alert("Error", errorMessage, [
          {
            text: "OK", onPress: () => {
              if (error.response && error.response.status === 404) router.back();
            }
          }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>←</Text></TouchableOpacity>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Property' : 'List Your Property'}</Text>
        <View style={{ width: 30 }} />
      </View>

      <ScrollView style={styles.formScroll} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.toggleWrapper}>
          <TouchableOpacity style={[styles.toggleOption, listingType === 'sell' && styles.toggleActive]} onPress={() => setListingType('sell')}><Text style={[styles.toggleText, listingType === 'sell' && styles.toggleTextActive]}>Sell</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.toggleOption, listingType === 'rent' && styles.toggleActive]} onPress={() => setListingType('rent')}><Text style={[styles.toggleText, listingType === 'rent' && styles.toggleTextActive]}>Rent</Text></TouchableOpacity>
        </View>

        <Text style={styles.label}>Property Title <Text style={styles.requiredAsterisk}>*</Text></Text>
        <TextInput
          style={[styles.input, errors.propertyName && styles.inputError]}
          placeholder="e.g. Plot for Sale, PG for Rent, Shop for Rent"
          placeholderTextColor="#8890a6"
          value={propertyName}
          onChangeText={(txt) => { setPropertyName(txt); if (errors.propertyName) setErrors({ ...errors, propertyName: null }); }}
        />
        {errors.propertyName && <Text style={styles.errorText}>{errors.propertyName}</Text>}

        <Text style={styles.label}>Property Type <Text style={styles.requiredAsterisk}>*</Text></Text>
        <View style={styles.chipRow}>
          {['House', 'Plot', 'Commercial'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.chip,
                propertyType === type && styles.chipActive,
                errors.propertyType && !propertyType && styles.chipError
              ]}
              onPress={() => { setPropertyType(type); if (errors.propertyType) setErrors({ ...errors, propertyType: null }); }}
            >
              <Text style={[styles.chipText, propertyType === type && styles.chipTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {errors.propertyType && <Text style={styles.errorText}>{errors.propertyType}</Text>}

        <Text style={styles.label}>Price <Text style={styles.requiredAsterisk}>*</Text></Text>
        <View style={[styles.inputContainerWithPicker, errors.price && styles.inputError]}>
          <TextInput
            style={[styles.flexInput, { borderRightWidth: 1, borderRightColor: '#eee' }]}
            placeholder="Amount"
            placeholderTextColor="#8890a6"
            keyboardType="numeric"
            value={price}
            onChangeText={(txt) => { setPrice(txt); if (errors.price) setErrors({ ...errors, price: null }); }}
          />
          <TouchableOpacity
            style={styles.pickerTrigger}
            onPress={() => { setPickerType('price'); setPickerVisible(true); }}
          >
            <Text style={styles.pickerTriggerText}>{priceUnit} ▾</Text>
          </TouchableOpacity>
        </View>
        {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
        {price ? (
          <Text style={styles.pricePreview}>
            ₹ {getRawPrice().toLocaleString('en-IN')}
          </Text>
        ) : null}

        {propertyType === 'House' && (
          <View style={styles.rowInputContainer}>
            <View style={{ flex: 1, marginRight: 10 }}><Text style={styles.label}>Bedrooms</Text><TextInput style={styles.input} placeholder="0" placeholderTextColor="#8890a6" keyboardType="numeric" value={bedrooms} onChangeText={setBedrooms} /></View>
            <View style={{ flex: 1 }}><Text style={styles.label}>Bathrooms</Text><TextInput style={styles.input} placeholder="0" placeholderTextColor="#8890a6" keyboardType="numeric" value={bathrooms} onChangeText={setBathrooms} /></View>
          </View>
        )}

        <Text style={styles.label}>Area Size <Text style={styles.requiredAsterisk}>*</Text></Text>
        <View style={[styles.inputContainerWithPicker, errors.area && styles.inputError]}>
          <TextInput
            style={[styles.flexInput, { borderRightWidth: 1, borderRightColor: '#eee' }]}
            placeholder="Size"
            placeholderTextColor="#8890a6"
            keyboardType="numeric"
            value={area}
            onChangeText={(txt) => { setArea(txt); if (errors.area) setErrors({ ...errors, area: null }); }}
          />
          <TouchableOpacity
            style={styles.pickerTrigger}
            onPress={() => { setPickerType('area'); setPickerVisible(true); }}
          >
            <Text style={styles.pickerTriggerText}>{areaUnit} ▾</Text>
          </TouchableOpacity>
        </View>
        {errors.area && <Text style={styles.errorText}>{errors.area}</Text>}

        <Text style={styles.label}>City <Text style={styles.requiredAsterisk}>*</Text></Text>
        <TextInput
          style={[styles.input, errors.city && styles.inputError]}
          placeholder="e.g. Sangrur, Sunam, Dhuri"
          placeholderTextColor="#8890a6"
          value={city}
          onChangeText={(txt) => { setCity(txt); if (errors.city) setErrors({ ...errors, city: null }); }}
        />
        {errors.city && <Text style={styles.errorText}>{errors.city}</Text>}

        <Text style={styles.label}>Address <Text style={styles.requiredAsterisk}>*</Text></Text>
        <View style={[styles.locationContainer, errors.location && styles.inputError]}>
          <TextInput
            style={[styles.input, { borderWidth: 0, marginBottom: 0, flex: 1 }]}
            placeholder="Full Address"
            placeholderTextColor="#8890a6"
            value={location}
            onChangeText={(txt) => { setLocation(txt); if (errors.location) setErrors({ ...errors, location: null }); }}
          />
          <View style={styles.pinButton}><Text style={{ fontSize: 20, opacity: 0.5 }}>📍</Text></View>
        </View>
        {errors.location && <Text style={styles.errorText}>{errors.location}</Text>}

        <Text style={styles.label}>Description <Text style={styles.requiredAsterisk}>*</Text></Text>
        <TextInput
          style={[styles.input, { height: 120, paddingTop: 12 }, errors.description && styles.inputError]}
          placeholder="Describe your property..."
          placeholderTextColor="#8890a6"
          multiline={true}
          value={description}
          onChangeText={(txt) => { setDescription(txt); if (errors.description) setErrors({ ...errors, description: null }); }}
          returnKeyType="done"
          blurOnSubmit={true}
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}

        <Text style={styles.label}>Amenities</Text>
        {amenitiesLoading ? (
          <ActivityIndicator size="small" color="#059669" style={{ marginVertical: 10 }} />
        ) : (
          <View style={styles.chipRow}>
            {allAmenities.map((amenity) => {
              const currentAmenityIds = amenities.map(item => typeof item === 'object' ? item.id : item);
              const isSelected = currentAmenityIds.includes(amenity.id);
              return (
                <TouchableOpacity
                  key={amenity.id}
                  style={[styles.chip, isSelected && styles.chipActive, { marginBottom: 10 }]}
                  onPress={() => {
                    if (isSelected) {
                      setAmenities(currentAmenityIds.filter(id => id !== amenity.id));
                    } else {
                      setAmenities([...currentAmenityIds, amenity.id]);
                    }
                  }}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>{amenity.name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={styles.label}>Property Images (Min 3) <Text style={styles.requiredAsterisk}>*</Text></Text>
        <View style={{ height: 100, marginBottom: 20 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
            <TouchableOpacity style={styles.addImageBtn} onPress={handleAddImage}><Text style={{ fontSize: 30, color: '#8890a6', marginTop: -2 }}>+</Text></TouchableOpacity>
            {images.map((img, index) => (
              <View key={index} style={styles.thumbnailContainer}>
                <Image source={{ uri: img.uri }} style={styles.thumbnail} contentFit="cover" transition={200} />
                <TouchableOpacity style={styles.removeBtn} onPress={() => handleRemoveImage(index)}><Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>✕</Text></TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          {isEditMode && (
            <TouchableOpacity
              style={[styles.postButton, { flex: 1, backgroundColor: '#8890a6' }]}
              onPress={() => router.back()}
            >
              <Text style={styles.postButtonText}>Cancel</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.postButton, { flex: isEditMode ? 2 : 1 }, loading && { opacity: 0.7 }]}
            onPress={handlePostProperty}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.postButtonText}>{isEditMode ? "Save Changes" : "Post Property"}</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* REUSABLE PICKER MODAL */}
      <Modal visible={pickerVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={() => setPickerVisible(false)}>
          <View style={styles.pickerContent}>
            <Text style={styles.pickerTitleSelect}>Select {pickerType === 'price' ? 'Unit' : 'Area Unit'}</Text>
            {(pickerType === 'price' ? (listingType === 'sell' ? sellPriceUnits : rentPriceUnits) : areaUnits).map((u) => (
              <TouchableOpacity
                key={u}
                style={styles.pickerItem}
                onPress={() => {
                  if (pickerType === 'price') setPriceUnit(u);
                  else setAreaUnit(u);
                  setPickerVisible(false);
                }}
              >
                <Text style={styles.pickerItemText}>{u}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.pickerCancel} onPress={() => setPickerVisible(false)}>
              <Text style={styles.pickerCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: Platform.OS === 'ios' ? 10 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  backButton: { padding: 5 },
  backText: { fontSize: 24, color: '#1a1f36' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1a1f36' },
  formScroll: { padding: 20 },
  toggleWrapper: { flexDirection: 'row', backgroundColor: '#F7F8FA', borderRadius: 12, padding: 4, marginBottom: 20 },
  toggleOption: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  toggleActive: { backgroundColor: '#fff', shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  toggleText: { fontWeight: '600', color: '#8890a6' },
  toggleTextActive: { color: '#059669' },
  label: { fontSize: 15, fontWeight: '700', color: '#1a1f36', marginBottom: 8, marginTop: 10 },
  input: { backgroundColor: '#F7F8FA', borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 17, color: '#1a1f36', marginBottom: 10 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#eee', marginRight: 10 },
  chipActive: { backgroundColor: '#059669', borderColor: '#059669' },
  chipText: { color: '#5e6c84' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  rowInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  unitSelector: { flexDirection: 'row', flex: 2, justifyContent: 'flex-end' },
  unitBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#F7F8FA', marginLeft: 6, borderWidth: 1, borderColor: '#eee' },
  unitBtnActive: { backgroundColor: '#059669', borderColor: '#059669' },
  unitText: { fontSize: 12, color: '#5e6c84' },
  unitTextActive: { color: '#fff' },
  locationContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FA', borderRadius: 12, paddingRight: 5, marginBottom: 10 },
  pinButton: { padding: 10, backgroundColor: '#fff', borderRadius: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  addImageBtn: { width: 80, height: 80, backgroundColor: '#F7F8FA', borderRadius: 12, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  thumbnailContainer: { position: 'relative', marginRight: 10 },
  thumbnail: { width: 80, height: 80, borderRadius: 12 },
  removeBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: 'red', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  postButton: { backgroundColor: '#059669', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 30, marginBottom: 20 },
  postButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // --- NEW STYLES FOR DROPDOWN & KEYBOARD ---
  inputContainerWithPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    borderRadius: 12,
    height: 50,
    marginBottom: 10,
    overflow: 'hidden'
  },
  flexInput: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    fontSize: 17,
    color: '#1a1f36'
  },
  pickerTrigger: {
    paddingHorizontal: 15,
    height: '100%',
    justifyContent: 'center',
    backgroundColor: '#f0f0f0'
  },
  pickerTriggerText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1f36'
  },
  dismissKeyboardButton: {
    position: 'absolute',
    right: 10,
    bottom: 20,
    backgroundColor: 'rgba(26, 31, 54, 0.8)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8
  },
  dismissKeyboardText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600'
  },

  // --- PICKER MODAL STYLES ---
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20
  },
  pickerContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    elevation: 5
  },
  pickerTitleSelect: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1f36',
    marginBottom: 20,
    textAlign: 'center'
  },
  pickerItem: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  pickerItemText: {
    fontSize: 16,
    color: '#1a1f36',
    textAlign: 'center'
  },
  pickerCancel: {
    marginTop: 15,
    paddingVertical: 10
  },
  pickerCancelText: {
    fontSize: 16,
    color: 'red',
    textAlign: 'center',
    fontWeight: '600'
  },
  pricePreview: {
    fontSize: 15,
    color: '#2B8344',
    fontWeight: '700',
    marginTop: -5,
    marginBottom: 10,
    marginLeft: 5
  },
  requiredAsterisk: {
    color: '#ff4d4f',
  },
  inputError: {
    borderColor: '#ff4d4f',
    borderWidth: 1.5,
  },
  chipError: {
    borderColor: '#ff4d4f',
    borderStyle: 'dashed',
  },
  errorText: {
    color: '#ff4d4f',
    fontSize: 12,
    marginTop: -5,
    marginBottom: 10,
    marginLeft: 5,
    fontWeight: '600',
  }
});