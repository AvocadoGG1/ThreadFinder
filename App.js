import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const GEMINI_API_KEY = 'YOUR_API_KEY';
const ACCENT = '#0F9B8E';
const PLACEHOLDER_IMAGE = 'https://picsum.photos/seed/outfit/400/200';

const RESULTS = [
  {
    id: '1',
    name: "Vintage Levi's Jacket",
    price: '$14',
    source: 'Depop',
    image: 'https://picsum.photos/seed/vintage-jacket/400/400',
  },
  {
    id: '2',
    name: 'Y2K Mini Skirt',
    price: '$28',
    source: 'Local - 0.4mi',
    image: 'https://picsum.photos/seed/y2k-mini-skirt/400/400',
  },
  {
    id: '3',
    name: 'Plaid Blazer',
    price: '$9',
    source: 'ThredUp',
    image: 'https://picsum.photos/seed/plaid-blazer/400/400',
  },
  {
    id: '4',
    name: 'Cargo Pants',
    price: '$22',
    source: 'Local - 1.2mi',
    image: 'https://picsum.photos/seed/cargo-pants/400/400',
  },
  {
    id: '5',
    name: 'Floral Slip Dress',
    price: '$17',
    source: 'Depop',
    image: 'https://picsum.photos/seed/floral-slip-dress/400/400',
  },
  {
    id: '6',
    name: 'Band Tee',
    price: '$11',
    source: 'ThredUp',
    image: 'https://picsum.photos/seed/band-tee/400/400',
  },
  {
    id: '7',
    name: 'Mom Jeans',
    price: '$25',
    source: 'Local - 0.8mi',
    image: 'https://picsum.photos/seed/mom-jeans/400/400',
  },
  {
    id: '8',
    name: 'Corduroy Jacket',
    price: '$19',
    source: 'Depop',
    image: 'https://picsum.photos/seed/corduroy-jacket/400/400',
  },
];

function extractTextFromGemini(responseJson) {
  return responseJson?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || '')
    .join('')
    .trim();
}

function parseTags(rawText) {
  if (!rawText) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawText);
    if (Array.isArray(parsed)) {
      return parsed.filter(Boolean).map((tag) => String(tag).trim()).slice(0, 6);
    }
  } catch (error) {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return parsed.filter(Boolean).map((tag) => String(tag).trim()).slice(0, 6);
        }
      } catch {
        return [];
      }
    }
  }

  return [];
}

export default function App() {
  const [selectedImageUri, setSelectedImageUri] = useState(null);
  const [tags, setTags] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [favorites, setFavorites] = useState({});

  const gridData = RESULTS.map((item) => ({
    ...item,
    favorite: Boolean(favorites[item.id]),
  }));

  const toggleFavorite = (id) => {
    setFavorites((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  const analyzeImage = async (base64Data, mimeType = 'image/jpeg') => {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY') {
      setIsAnalyzing(false);
      Alert.alert('Add API key', 'Replace YOUR_API_KEY in App.js before using Gemini.');
      return;
    }

    if (!base64Data) {
      setIsAnalyzing(false);
      Alert.alert('Image unavailable', 'The selected image could not be converted to base64.');
      return;
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: 'Analyze this clothing item. Return ONLY a JSON array of 4-6 short style tags, e.g. ["Y2K", "Navy", "Denim"]. No explanation.',
                  },
                  {
                    inline_data: {
                      mime_type: mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
          }),
        }
      );

      const responseJson = await response.json();

      if (!response.ok) {
        const message = responseJson?.error?.message || 'Gemini request failed.';
        throw new Error(message);
      }

      const nextTags = parseTags(extractTextFromGemini(responseJson));
      setTags(nextTags);
    } catch (error) {
      setTags([]);
      Alert.alert('Analysis failed', error.message || 'Unable to analyze this image right now.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handlePickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to choose an outfit image.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [2, 1],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets?.length) {
      return;
    }

    const asset = result.assets[0];

    setSelectedImageUri(asset.uri);
    setTags([]);
    setIsAnalyzing(true);

    await analyzeImage(asset.base64, asset.mimeType || 'image/jpeg');
  };

  const renderItem = ({ item }) => (
    <View style={styles.resultCard}>
      <Image source={{ uri: item.image }} style={styles.resultImage} />
      <Pressable style={styles.heartButton} onPress={() => toggleFavorite(item.id)}>
        <Text style={[styles.heartIcon, item.favorite && styles.heartIconActive]}>
          {item.favorite ? '\u2665' : '\u2661'}
        </Text>
      </Pressable>
      <View style={styles.resultBody}>
        <Text style={styles.resultName} numberOfLines={2}>
          {item.name}
        </Text>
        <Text style={styles.resultPrice}>{item.price}</Text>
        <View style={styles.sourceBadge}>
          <Text style={styles.sourceText}>{item.source}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={styles.backgroundGlowTop} />
      <View style={styles.backgroundGlowBottom} />

      <FlatList
        data={gridData}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={2}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.title}>ThreadFinder</Text>
              <Text style={styles.subtitle}>Snap. Search. Thrift.</Text>
            </View>

            <View style={styles.previewCard}>
              <Image source={{ uri: selectedImageUri || PLACEHOLDER_IMAGE }} style={styles.previewImage} />
              <View style={styles.previewOverlay}>
                <Text style={styles.previewLabel}>AI Outfit Match</Text>
              </View>
            </View>

            {isAnalyzing ? (
              <View style={styles.analyzingRow}>
                <ActivityIndicator color={ACCENT} size="small" />
                <Text style={styles.analyzingText}>Analyzing...</Text>
              </View>
            ) : null}

            {tags.length > 0 ? (
              <View style={styles.tagsSection}>
                {tags.map((tag) => (
                  <View key={tag} style={styles.tagChip}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Fresh Matches</Text>
              <Text style={styles.sectionMeta}>8 finds</Text>
            </View>
          </View>
        }
      />

      <Pressable style={styles.fab} onPress={handlePickImage}>
        <Text style={styles.fabIcon}>{'\uD83D\uDCF7'}</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  backgroundGlowTop: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(15, 155, 142, 0.18)',
  },
  backgroundGlowBottom: {
    position: 'absolute',
    bottom: 120,
    left: -70,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(67, 97, 238, 0.12)',
  },
  contentContainer: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 110,
  },
  header: {
    marginBottom: 18,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 6,
    color: ACCENT,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  previewCard: {
    backgroundColor: '#16213E',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    shadowColor: '#000000',
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  previewImage: {
    width: '100%',
    height: 208,
  },
  previewOverlay: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: 'rgba(22, 33, 62, 0.82)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  previewLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  analyzingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  analyzingText: {
    color: '#B0B8C1',
    fontSize: 14,
  },
  tagsSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  tagChip: {
    backgroundColor: 'rgba(15, 155, 142, 0.16)',
    borderColor: 'rgba(15, 155, 142, 0.45)',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  tagText: {
    color: '#C7FFF7',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  sectionMeta: {
    color: '#B0B8C1',
    fontSize: 13,
  },
  columnWrapper: {
    justifyContent: 'space-between',
  },
  resultCard: {
    width: '48.5%',
    backgroundColor: '#16213E',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  resultImage: {
    width: '100%',
    aspectRatio: 1,
  },
  heartButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(26, 26, 46, 0.78)',
  },
  heartIcon: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  heartIconActive: {
    color: '#FF4D6D',
  },
  resultBody: {
    padding: 12,
  },
  resultName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    minHeight: 38,
  },
  resultPrice: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
  },
  sourceBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  sourceText: {
    color: '#B0B8C1',
    fontSize: 11,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 22,
    bottom: 28,
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ACCENT,
    shadowColor: ACCENT,
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  fabIcon: {
    fontSize: 26,
  },
});
