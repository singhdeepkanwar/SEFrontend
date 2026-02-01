/* CHANGES:
   1. Added validation for content checking using validateInput.
   2. Parsed `propertyData` from params to pre-fill fields in Edit Mode.
   3. Changed Button text to "Save Changes" if editing.
*/

import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, TextInput, ScrollView, Alert, Image, ActivityIndicator, Platform,
  SafeAreaView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { createProperty, updateProperty, MEDIA_BASE_URL } from '../services/api';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { validateInput } from '../utils/validation';

export default function ListPropertyPage() {
  const router = useRouter();
  const { propertyData } = useLocalSearchParams();

  const propertyToEdit = propertyData ? JSON.parse(propertyData) : null;
  const isEditMode = !!propertyToEdit;
  const [loading, setLoading] = useState(false);

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

  const [location, setLocation] = useState(propertyToEdit?.address || 'Sangrur');
  const [description, setDescription] = useState(propertyToEdit?.description || '');
  const [amenities, setAmenities] = useState(propertyToEdit?.amenities || []);

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

  const areaUnits = ["Gaj", "Sq. Yard", "Marla", "Kanal", "Acre", "Sq. Feet"];
  const sellPriceUnits = ["Lakh", "Crore"];
  const rentPriceUnits = ["Thousand", "Lakh"];

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
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
    // Validation
    if (!validateInput(propertyName, "Property Name") || !validateInput(description, "Description") || !validateInput(location, "Location")) return;
    if (!propertyName || !price || !area || !location) {
      Alert.alert("Missing Fields", "Please fill in all required fields.");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      const unitMap = { "Gaj": "SQYD", "Sq. Yard": "SQYD", "Sq. Feet": "SQFT", "Marla": "MARLA", "Kanal": "KANAL", "Acre": "ACRE", "Sq. Meter": "SQMTR" };

      formData.append('title', propertyName);
      formData.append('price', getRawPrice());
      formData.append('description', description);
      formData.append('address', location);
      formData.append('city', 'Sangrur');
      formData.append('listing_type', listingType === 'sell' ? 'SALE' : 'RENT');
      formData.append('property_type', propertyType.toUpperCase());
      formData.append('area', area);
      const unit = unitMap[areaUnit] || (Object.values(unitMap).includes(areaUnit) ? areaUnit : 'SQFT');
      formData.append('unit', unit);
      if (propertyType === 'House') {
        formData.append('bedrooms', bedrooms);
        formData.append('bathrooms', bathrooms);
      }

      // Handle amenities (Backend dev Guideline: array[int])
      // Handle amenities (Backend dev Guideline: array[int])
      if (amenities && amenities.length > 0) {
        amenities.forEach(id => formData.append('amenities', String(id)));
      }

      if (__DEV__) {
        console.log("FormData being sent:");
        console.log("Title:", propertyName, "Price:", getRawPrice(), "Unit:", unit, "Area:", area);
        if (isEditMode) console.log("Deleting Images:", deletedImageIds);
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

      Alert.alert("Success", isEditMode ? "Property Updated!" : "Property Listed!");
      router.back();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to list property.");
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

        <Text style={styles.label}>Property Name</Text>
        <TextInput style={styles.input} placeholder="e.g. Sunny Villa" value={propertyName} onChangeText={setPropertyName} />

        <Text style={styles.label}>Property Type</Text>
        <View style={styles.chipRow}>
          {['House', 'Plot', 'Commercial'].map((type) => (
            <TouchableOpacity key={type} style={[styles.chip, propertyType === type && styles.chipActive]} onPress={() => setPropertyType(type)}><Text style={[styles.chipText, propertyType === type && styles.chipTextActive]}>{type}</Text></TouchableOpacity>
          ))}
        </View>

        <Text style={styles.label}>Price</Text>
        <View style={styles.rowInputContainer}>
          <TextInput style={[styles.input, { flex: 2, marginRight: 10 }]} placeholder="Amount" keyboardType="numeric" value={price} onChangeText={setPrice} />
          <View style={styles.unitSelector}>
            {(listingType === 'sell' ? sellPriceUnits : rentPriceUnits).map(u => (
              <TouchableOpacity key={u} style={[styles.unitBtn, priceUnit === u && styles.unitBtnActive]} onPress={() => setPriceUnit(u)}><Text style={[styles.unitText, priceUnit === u && styles.unitTextActive]}>{u}</Text></TouchableOpacity>
            ))}
          </View>
        </View>

        {propertyType === 'House' && (
          <View style={styles.rowInputContainer}>
            <View style={{ flex: 1, marginRight: 10 }}><Text style={styles.label}>Bedrooms</Text><TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={bedrooms} onChangeText={setBedrooms} /></View>
            <View style={{ flex: 1 }}><Text style={styles.label}>Bathrooms</Text><TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={bathrooms} onChangeText={setBathrooms} /></View>
          </View>
        )}

        <Text style={styles.label}>Area Size</Text>
        <View style={styles.rowInputContainer}>
          <TextInput style={[styles.input, { flex: 1.5, marginRight: 10 }]} placeholder="Size" keyboardType="numeric" value={area} onChangeText={setArea} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 2 }}>
            {areaUnits.map(u => (
              <TouchableOpacity key={u} style={[styles.unitBtn, areaUnit === u && styles.unitBtnActive]} onPress={() => setAreaUnit(u)}><Text style={[styles.unitText, areaUnit === u && styles.unitTextActive]}>{u.split('/')[0]}</Text></TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <Text style={styles.label}>Location</Text>
        <View style={styles.locationContainer}>
          <TextInput style={[styles.input, { borderWidth: 0, marginBottom: 0, flex: 1 }]} placeholder="Enter Address" value={location} onChangeText={setLocation} />
          <TouchableOpacity style={styles.pinButton} onPress={() => Alert.alert("Map Feature", "Map Pin Drop here.")}><Text style={{ fontSize: 20 }}>📍</Text></TouchableOpacity>
        </View>

        <Text style={styles.label}>Description</Text>
        <TextInput style={[styles.input, { height: 100, paddingTop: 12 }]} placeholder="Describe your property..." multiline={true} value={description} onChangeText={setDescription} />

        <Text style={styles.label}>Property Images</Text>
        <View style={{ height: 100, marginBottom: 20 }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center' }}>
            <TouchableOpacity style={styles.addImageBtn} onPress={handleAddImage}><Text style={{ fontSize: 30, color: '#8890a6', marginTop: -2 }}>+</Text></TouchableOpacity>
            {images.map((img, index) => (
              <View key={index} style={styles.thumbnailContainer}>
                <Image source={{ uri: img.uri }} style={styles.thumbnail} />
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
    </SafeAreaView>
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
  toggleTextActive: { color: '#1a1f36' },
  label: { fontSize: 14, fontWeight: '600', color: '#5e6c84', marginBottom: 8, marginTop: 10 },
  input: { backgroundColor: '#F7F8FA', borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 16, color: '#1a1f36', marginBottom: 10 },
  chipRow: { flexDirection: 'row', marginBottom: 10 },
  chip: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#eee', marginRight: 10 },
  chipActive: { backgroundColor: '#1a1f36', borderColor: '#1a1f36' },
  chipText: { color: '#5e6c84' },
  chipTextActive: { color: '#fff', fontWeight: '600' },
  rowInputContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  unitSelector: { flexDirection: 'row', flex: 2, justifyContent: 'flex-end' },
  unitBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#F7F8FA', marginLeft: 6, borderWidth: 1, borderColor: '#eee' },
  unitBtnActive: { backgroundColor: '#1a1f36', borderColor: '#1a1f36' },
  unitText: { fontSize: 12, color: '#5e6c84' },
  unitTextActive: { color: '#fff' },
  locationContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F7F8FA', borderRadius: 12, paddingRight: 5, marginBottom: 10 },
  pinButton: { padding: 10, backgroundColor: '#fff', borderRadius: 10, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  addImageBtn: { width: 80, height: 80, backgroundColor: '#F7F8FA', borderRadius: 12, borderWidth: 1, borderColor: '#ddd', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  thumbnailContainer: { position: 'relative', marginRight: 10 },
  thumbnail: { width: 80, height: 80, borderRadius: 12 },
  removeBtn: { position: 'absolute', top: -5, right: -5, backgroundColor: 'red', width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  postButton: { backgroundColor: '#1a1f36', height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 30, marginBottom: 20 },
  postButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});