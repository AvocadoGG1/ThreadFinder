import { StatusBar } from 'expo-status-bar';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const GEMINI_API_KEY = 'AIzaSyAZLLg5qoy24B9GmQiBf_pzsSKLTqk4SbI';
const ACCENT = '#0F9B8E';
const DEFAULT_PREVIEW_IMAGE = require('./P0.jpg');
const DEFAULT_MATCH_TAGS = ['Band Tee', 'Graphic Tee', 'Black', 'Vintage', 'Streetwear'];

const CATALOG = [
  {
    id: '1',
    name: 'Washed Black Graphic Tee',
    price: '$18',
    source: 'Depop',
    image: 'https://images.pexels.com/photos/33258835/pexels-photo-33258835.jpeg?auto=compress&cs=tinysrgb&w=800',
    tags: ['Band Tee', 'Graphic Tee', 'Black', 'Streetwear', 'Vintage'],
  },
  {
    id: '2',
    name: 'Back Print Street Tee',
    price: '$22',
    source: 'Grailed',
    image: 'https://images.pexels.com/photos/6633712/pexels-photo-6633712.jpeg?auto=compress&cs=tinysrgb&w=800',
    tags: ['Graphic Tee', 'Black', 'Streetwear', 'Oversized', 'Vintage'],
  },
  {
    id: '3',
    name: 'Faded Black Trucker',
    price: '$29',
    source: 'ThredUp',
    image: 'https://images.pexels.com/photos/36607420/pexels-photo-36607420.jpeg?auto=compress&cs=tinysrgb&w=800',
    tags: ['Black', 'Vintage', 'Streetwear', 'Jacket', 'Layering'],
  },
  {
    id: '4',
    name: 'Double-Knee Cargo Pant',
    price: '$26',
    source: 'Local - 1.2mi',
    image: 'https://images.pexels.com/photos/35043249/pexels-photo-35043249.jpeg?auto=compress&cs=tinysrgb&w=800',
    tags: ['Cargo', 'Black', 'Streetwear', 'Utility', 'Vintage'],
  },
  {
    id: '5',
    name: 'Relaxed Utility Trouser',
    price: '$21',
    source: 'eBay',
    image: 'https://images.pexels.com/photos/17037281/pexels-photo-17037281.jpeg?auto=compress&cs=tinysrgb&w=800',
    tags: ['Cargo', 'Black', 'Streetwear', 'Relaxed', 'Utility'],
  },
  {
    id: '6',
    name: 'Heavyweight Graphic Hoodie',
    price: '$31',
    source: 'Poshmark',
    image: 'https://images.pexels.com/photos/22743405/pexels-photo-22743405.jpeg?auto=compress&cs=tinysrgb&w=800',
    tags: ['Graphic', 'Black', 'Streetwear', 'Hoodie', 'Layering'],
  },
  {
    id: '7',
    name: 'Dark Denim Overshirt',
    price: '$33',
    source: 'Depop',
    image: 'https://images.pexels.com/photos/14416498/pexels-photo-14416498.jpeg?auto=compress&cs=tinysrgb&w=800',
    tags: ['Denim', 'Dark', 'Vintage', 'Streetwear', 'Layering'],
  },
];

function toTitleCase(value) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function formatTags(tags) {
  const seen = new Set();

  return tags
    .map((tag) => String(tag || '').trim())
    .filter(Boolean)
    .map((tag) => toTitleCase(tag))
    .filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

function normalizeTag(tag) {
  return String(tag || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tagScore(a, b) {
  const left = normalizeTag(a);
  const right = normalizeTag(b);

  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 5;
  }

  if (left.includes(right) || right.includes(left)) {
    return 3;
  }

  const leftWords = left.split(' ');
  const rightWords = right.split(' ');
  const shared = leftWords.filter((word) => rightWords.includes(word));

  return shared.length ? shared.length : 0;
}

function getMatchReason(itemTags, activeTags) {
  let bestTag = '';
  let bestScore = 0;

  itemTags.forEach((itemTag) => {
    activeTags.forEach((activeTag) => {
      const score = tagScore(itemTag, activeTag);
      if (score > bestScore) {
        bestScore = score;
        bestTag = itemTag;
      }
    });
  });

  return bestTag;
}

function rankCatalog(activeTags) {
  const effectiveTags = activeTags.length ? activeTags : DEFAULT_MATCH_TAGS;

  return CATALOG.map((item) => {
    const score = item.tags.reduce((total, itemTag) => {
      return total + effectiveTags.reduce((tagTotal, activeTag) => tagTotal + tagScore(itemTag, activeTag), 0);
    }, 0);

    return {
      ...item,
      matchReason: getMatchReason(item.tags, effectiveTags),
      score,
    };
  }).sort((left, right) => right.score - left.score);
}

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
      return formatTags(parsed);
    }
  } catch (error) {
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) {
          return formatTags(parsed);
        }
      } catch {
        return [];
      }
    }
  }

  return [];
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onloadend = () => {
      const dataUrl = String(reader.result || '');
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function uriToBase64(uri) {
  if (!uri) {
    return '';
  }

  const response = await fetch(uri);
  const blob = await response.blob();
  return blobToBase64(blob);
}

export default function App() {
  const isWeb = Platform.OS === 'web';
  const [selectedImageUri, setSelectedImageUri] = useState(null);
  const [tags, setTags] = useState([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [favorites, setFavorites] = useState({});
  const [hasLoadedDefault, setHasLoadedDefault] = useState(false);

  const gridData = rankCatalog(tags).map((item) => ({
    ...item,
    favorite: Boolean(favorites[item.id]),
  }));

  const toggleFavorite = (id) => {
    setFavorites((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  const analyzeImage = async (base64Data, mimeType = 'image/jpeg', options = {}) => {
    const { fallbackTags = [], suppressAlerts = false } = options;

    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'YOUR_API_KEY') {
      setIsAnalyzing(false);
      setTags(fallbackTags);
      if (!suppressAlerts) {
        Alert.alert('Add API key', 'Replace YOUR_API_KEY in App.js before using Gemini.');
      }
      return fallbackTags;
    }

    if (!base64Data) {
      setIsAnalyzing(false);
      setTags(fallbackTags);
      if (!suppressAlerts) {
        Alert.alert('Image unavailable', 'The selected image could not be converted to base64.');
      }
      return fallbackTags;
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
      const resolvedTags = nextTags.length ? nextTags : fallbackTags;
      setTags(resolvedTags);
      return resolvedTags;
    } catch (error) {
      setTags(fallbackTags);
      if (!suppressAlerts) {
        Alert.alert('Analysis failed', error.message || 'Unable to analyze this image right now.');
      }
      return fallbackTags;
    } finally {
      setIsAnalyzing(false);
    }
  };

  useEffect(() => {
    let isActive = true;

    const analyzeDefaultImage = async () => {
      if (hasLoadedDefault) {
        return;
      }

      setHasLoadedDefault(true);
      setIsAnalyzing(true);

      try {
        const asset = Image.resolveAssetSource(DEFAULT_PREVIEW_IMAGE);
        const base64Data = await uriToBase64(asset?.uri);

        if (!isActive) {
          return;
        }

        await analyzeImage(base64Data, 'image/jpeg', {
          fallbackTags: DEFAULT_MATCH_TAGS,
          suppressAlerts: true,
        });
      } catch {
        if (isActive) {
          setTags(DEFAULT_MATCH_TAGS);
          setIsAnalyzing(false);
        }
      }
    };

    analyzeDefaultImage();

    return () => {
      isActive = false;
    };
  }, [hasLoadedDefault]);

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
      <Image source={typeof item.image === 'string' ? { uri: item.image } : item.image} style={styles.resultImage} />
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
          <Text style={styles.sourceText}>{`${item.source} | ${item.matchReason || 'Match'}`}</Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      <View style={[styles.appShell, isWeb && styles.appShellWeb]}>
        <View style={styles.backgroundGlowTop} />
        <View style={styles.backgroundGlowBottom} />

        <FlatList
          data={gridData}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={2}
          showsVerticalScrollIndicator={false}
          style={styles.feed}
          contentContainerStyle={styles.contentContainer}
          columnWrapperStyle={styles.columnWrapper}
          ListHeaderComponent={
            <View>
              <View style={styles.header}>
                <Text style={styles.title}>ThreadFinder</Text>
                <Text style={styles.subtitle}>Snap. Search. Thrift.</Text>
              </View>

              <View style={styles.previewCard}>
                <Image
                  source={selectedImageUri ? { uri: selectedImageUri } : DEFAULT_PREVIEW_IMAGE}
                  style={styles.previewImage}
                />
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
                <Text style={styles.sectionMeta}>{gridData.length} finds</Text>
              </View>
            </View>
          }
        />

        <Pressable style={[styles.fab, isWeb && styles.fabWeb]} onPress={handlePickImage}>
          <Text style={styles.fabIcon}>{'\uD83D\uDCF7'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#1A1A2E',
    padding: 12,
  },
  appShell: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#1A1A2E',
  },
  appShellWeb: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 16 },
  },
  feed: {
    flex: 1,
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
  fabWeb: {
    right: 18,
    bottom: 40,
  },
  fabIcon: {
    fontSize: 26,
    lineHeight: 26,
    textAlign: 'center',
    marginTop: -2,
  },
});
