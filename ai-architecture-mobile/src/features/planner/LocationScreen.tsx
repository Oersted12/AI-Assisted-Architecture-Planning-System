import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import MapView from 'react-native-maps';
import type { Region } from 'react-native-maps';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  JAFFNA_BOUNDS,
  JAFFNA_CENTER,
  MAX_RECENT_LOCATIONS,
} from '@/constants/architecture';
import {
  ActionButton,
  Card,
  InlineMessage,
  PlannerInput,
  PlannerPage,
  SectionTitle,
  plannerColors,
} from '@/features/planner/components';
import type {
  RecentLocation,
  SelectedLocation,
} from '@/features/planner/types';
import { checkLocation } from '@/services/api';
import {
  geocodeAddress,
  reverseGeocode,
} from '../../../services/nominatim';

const HISTORY_KEY = 'ai_arch_location_history';

function isRecentLocation(value: unknown): value is RecentLocation {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const item = value as Partial<RecentLocation>;
  return (
    typeof item.lat === 'number' &&
    typeof item.lng === 'number' &&
    typeof item.address === 'string' &&
    typeof item.savedAt === 'string'
  );
}

function isInJaffnaBounds(lat: number, lng: number): boolean {
  return (
    lat >= JAFFNA_BOUNDS.minLat &&
    lat <= JAFFNA_BOUNDS.maxLat &&
    lng >= JAFFNA_BOUNDS.minLng &&
    lng <= JAFFNA_BOUNDS.maxLng
  );
}

export function LocationScreen({
  onConfirmed,
  onContinue,
  initialLocation = null,
}: {
  onConfirmed: (location: SelectedLocation) => void;
  onContinue: () => void;
  initialLocation?: SelectedLocation | null;
}) {
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState<RecentLocation[]>([]);
  const [historyMessage, setHistoryMessage] = useState('');
  const [selectedPoint, setSelectedPoint] = useState<SelectedLocation | null>(null);
  const [searching, setSearching] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmedLocation, setConfirmedLocation] =
    useState<SelectedLocation | null>(initialLocation);
  const autoGpsAttempted = useRef(false);

  const loadRecentLocations = useCallback(async () => {
    try {
      const saved = await AsyncStorage.getItem(HISTORY_KEY);
      if (!saved) {
        setRecent([]);
        return;
      }
      const parsed: unknown = JSON.parse(saved);
      setRecent(
        Array.isArray(parsed)
          ? parsed.filter(isRecentLocation).slice(0, MAX_RECENT_LOCATIONS)
          : [],
      );
    } catch {
      setHistoryMessage('Recent locations could not be loaded on this device.');
    }
  }, []);

  useEffect(() => {
    void loadRecentLocations();
  }, [loadRecentLocations]);

  const detectGps = useCallback(async () => {
    setError('');
    setGpsLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        throw new Error('Location access denied. Please search for an address instead.');
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude: lat, longitude: lng } = position.coords;
      if (!isInJaffnaBounds(lat, lng)) {
        throw new Error(
          `Your device appears to be outside Jaffna District (${lat.toFixed(3)}, ${lng.toFixed(3)}). Please search for your land address.`,
        );
      }
      setSelectedPoint({ lat, lng, address: '' });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not detect location. Please search for an address.',
      );
    } finally {
      setGpsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialLocation && !autoGpsAttempted.current) {
      autoGpsAttempted.current = true;
      void detectGps();
    }
  }, [detectGps, initialLocation]);

  const searchAddress = async () => {
    if (!query.trim()) {
      setError('Enter an address to search.');
      return;
    }
    setError('');
    setSearching(true);
    try {
      const result = await geocodeAddress(query.trim());
      setSelectedPoint({
        lat: result.lat,
        lng: result.lng,
        address: result.displayName,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Address search failed.');
    } finally {
      setSearching(false);
    }
  };

  const clearHistory = async () => {
    try {
      await AsyncStorage.removeItem(HISTORY_KEY);
      setRecent([]);
      setHistoryMessage('');
    } catch {
      setHistoryMessage('Recent locations could not be cleared.');
    }
  };

  const confirmLocation = async (location: SelectedLocation) => {
    const savedLocation: RecentLocation = {
      ...location,
      savedAt: new Date().toISOString(),
    };
    try {
      const next = [
        savedLocation,
        ...recent.filter((item) => item.address !== location.address),
      ].slice(0, MAX_RECENT_LOCATIONS);
      await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
      setRecent(next);
      setHistoryMessage('');
    } catch {
      Alert.alert(
        'Recent location not saved',
        'Location history could not be saved on this device. You can still continue.',
      );
    }
    setConfirmedLocation(location);
    onConfirmed(location);
  };

  if (selectedPoint) {
    return (
      <MapPicker
        initialPoint={selectedPoint}
        onBack={() => setSelectedPoint(null)}
        onConfirmed={(location) => void confirmLocation(location)}
      />
    );
  }

  return (
    <PlannerPage>
      <View style={styles.hero}>
        <Text style={styles.heroIcon}>🏗️</Text>
        <Text style={styles.heroTitle}>AI Architecture Planning</Text>
        <Text style={styles.heroSubtitle}>Jaffna District, Sri Lanka</Text>
      </View>

      <Card>
        <ActionButton
          title={gpsLoading ? 'Detecting your location...' : 'Use My Current Location'}
          onPress={() => void detectGps()}
          loading={gpsLoading}
          secondary
        />
        <Text style={styles.separator}>or enter a land address</Text>
        <PlannerInput
          accessibilityLabel="Land address"
          value={query}
          onChangeText={setQuery}
          placeholder="e.g. Punitha Anthoniyar Road, Chunnakam"
          autoCapitalize="words"
          returnKeyType="search"
          onSubmitEditing={() => void searchAddress()}
        />
        <ActionButton
          title="Find on Map"
          onPress={() => void searchAddress()}
          loading={searching}
        />
        <ActionButton
          title="Open Map at Jaffna"
          onPress={() => setSelectedPoint({ ...JAFFNA_CENTER, address: '' })}
          secondary
        />
        {error ? <InlineMessage>{error}</InlineMessage> : null}
        {historyMessage ? <InlineMessage kind="info">{historyMessage}</InlineMessage> : null}
      </Card>

      {confirmedLocation ? (
        <Card>
          <SectionTitle>Location confirmed</SectionTitle>
          <Text style={styles.historyAddress}>{confirmedLocation.address}</Text>
          <Text style={styles.historyCoordinates}>
            {confirmedLocation.lat.toFixed(6)}, {confirmedLocation.lng.toFixed(6)}
          </Text>
          <ActionButton title="Continue to Land Details" onPress={onContinue} />
          <ActionButton
            title="Change location"
            onPress={() => setSelectedPoint(confirmedLocation)}
            secondary
          />
        </Card>
      ) : null}

      {recent.length > 0 ? (
        <Card>
          <View style={styles.historyHeading}>
            <Text style={styles.historyTitle}>Recent Locations</Text>
            <Pressable onPress={() => void clearHistory()} accessibilityRole="button">
              <Text style={styles.clearText}>Clear All</Text>
            </Pressable>
          </View>
          {recent.map((item) => (
            <Pressable
              key={`${item.address}-${item.savedAt}`}
              onPress={() => setSelectedPoint(item)}
              style={styles.historyItem}
              accessibilityRole="button"
            >
              <Text style={styles.historyAddress}>{item.address}</Text>
              <Text style={styles.historyCoordinates}>
                {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
              </Text>
            </Pressable>
          ))}
        </Card>
      ) : null}
    </PlannerPage>
  );
}

function MapPicker({
  initialPoint,
  onBack,
  onConfirmed,
}: {
  initialPoint: SelectedLocation;
  onBack: () => void;
  onConfirmed: (location: SelectedLocation) => void;
}) {
  const [point, setPoint] = useState({
    lat: initialPoint.lat,
    lng: initialPoint.lng,
  });
  const [address, setAddress] = useState('');
  const [addressReady, setAddressReady] = useState(false);
  const [loadingAddress, setLoadingAddress] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const requestId = useRef(0);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAddress = useCallback(async (lat: number, lng: number) => {
    const currentRequestId = ++requestId.current;
    setLoadingAddress(true);
    setAddressReady(false);
    try {
      const result = await reverseGeocode(lat, lng);
      if (currentRequestId !== requestId.current) {
        return;
      }
      const resolved = result.trim();
      if (
        !resolved ||
        ['unknown location', 'could not fetch address'].includes(resolved.toLowerCase())
      ) {
        throw new Error('Could not fetch address for this pin.');
      }
      setAddress(resolved);
      setAddressReady(true);
      setError('');
    } catch (cause) {
      if (currentRequestId === requestId.current) {
        setAddress('');
        setAddressReady(false);
        setError(cause instanceof Error ? cause.message : 'Could not fetch address.');
      }
    } finally {
      if (currentRequestId === requestId.current) {
        setLoadingAddress(false);
      }
    }
  }, []);

  useEffect(() => {
    void fetchAddress(initialPoint.lat, initialPoint.lng);
    return () => {
      requestId.current += 1;
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [fetchAddress, initialPoint.lat, initialPoint.lng]);

  const onRegionChangeComplete = (region: Region) => {
    const lat = region.latitude;
    const lng = region.longitude;
    setPoint({ lat, lng });
    setAddressReady(false);
    setError('');
    setLoadingAddress(true);
    requestId.current += 1;
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }
    debounceTimer.current = setTimeout(() => {
      void fetchAddress(lat, lng);
    }, 600);
  };

  const confirm = async () => {
    if (!addressReady || loadingAddress) {
      return;
    }
    setChecking(true);
    setError('');
    try {
      await checkLocation(point.lat, point.lng);
      onConfirmed({ ...point, address });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not check this location.');
    } finally {
      setChecking(false);
    }
  };

  const region: Region = {
    latitude: initialPoint.lat,
    longitude: initialPoint.lng,
    latitudeDelta: 0.006,
    longitudeDelta: 0.006,
  };
  const outsideJaffna = !isInJaffnaBounds(point.lat, point.lng);

  return (
    <SafeAreaView style={styles.mapContainer} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.mapContainer}>
        <MapView
          style={StyleSheet.absoluteFill}
          initialRegion={region}
          onRegionChangeComplete={onRegionChangeComplete}
        />
        <View pointerEvents="none" style={styles.mapPin}>
          <Text style={styles.mapPinText}>📍</Text>
        </View>
        <View style={styles.mapTop}>
          <Pressable onPress={onBack} style={styles.mapBack} accessibilityRole="button">
            <Text style={styles.mapBackText}>Back</Text>
          </Pressable>
          <Text style={styles.mapLabel}>Selected Location</Text>
          <Text style={styles.mapAddress}>
            {loadingAddress ? 'Fetching address...' : address || 'Address unavailable'}
          </Text>
          <Text style={styles.mapCoordinates}>
            {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
          </Text>
          {outsideJaffna ? (
            <Text style={styles.outsideWarning}>
              This spot appears outside Jaffna District. Drag the map to your land.
            </Text>
          ) : null}
        </View>
        <View style={styles.mapBottom}>
          {error ? <InlineMessage>{error}</InlineMessage> : null}
          <ActionButton
            title={checking ? 'Checking location...' : 'Confirm This Location'}
            onPress={() => void confirm()}
            disabled={!addressReady || loadingAddress}
            loading={checking}
          />
          {loadingAddress ? <ActivityIndicator color={plannerColors.navy} /> : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: plannerColors.navy,
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    gap: 5,
  },
  heroIcon: { fontSize: 36 },
  heroTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  heroSubtitle: { color: '#AED6F1', fontSize: 13 },
  separator: { color: plannerColors.muted, textAlign: 'center', fontSize: 13 },
  historyHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyTitle: { color: plannerColors.navy, fontSize: 16, fontWeight: '800' },
  clearText: { color: plannerColors.red, fontSize: 13, fontWeight: '700', padding: 8 },
  historyItem: { paddingVertical: 11, borderTopWidth: 1, borderTopColor: '#E8EDF3', gap: 3 },
  historyAddress: { color: plannerColors.navy, fontSize: 14, fontWeight: '700' },
  historyCoordinates: { color: plannerColors.muted, fontSize: 12 },
  mapContainer: { flex: 1, minHeight: 450, backgroundColor: plannerColors.light },
  mapPin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -18,
    marginTop: -40,
  },
  mapPinText: { fontSize: 38 },
  mapTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  mapBack: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: plannerColors.navy,
  },
  mapBackText: { color: '#FFFFFF', fontWeight: '700' },
  mapLabel: { color: plannerColors.gold, fontWeight: '800', fontSize: 14 },
  mapAddress: { color: plannerColors.text, fontSize: 14, lineHeight: 20 },
  mapCoordinates: { color: plannerColors.muted, fontSize: 12 },
  outsideWarning: { color: '#9A6700', fontSize: 12, lineHeight: 18 },
  mapBottom: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 20,
    gap: 8,
  },
});
