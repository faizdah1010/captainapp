import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { TariqMapView, Marker } from '@/components/ui/TariqMap';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useRide } from '@/hooks/useRide';
import { AdBanner } from '@/components/ui/AdBanner';
import { ServiceCard } from '@/components/feature/ServiceCard';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { CONFIG } from '@/constants/config';
import { ServiceType } from '@/contexts/RideContext';

const SERVICES: { type: ServiceType; icon: any; titleKey: any; descKey: any }[] = [
  { type: 'regular', icon: 'directions-car', titleKey: 'tariqRegular', descKey: 'tariqRegularDesc' },
  { type: 'ladies', icon: 'face', titleKey: 'tariqLadies', descKey: 'tariqLadiesDesc' },
  { type: 'express', icon: 'local-shipping', titleKey: 'tariqExpress', descKey: 'tariqExpressDesc' },
];

const QUICK_PLACES_AR = [
  { id: '1', name: 'عمّان', icon: 'location-city' },
  { id: '2', name: 'إربد', icon: 'place' },
  { id: '3', name: 'الزرقاء', icon: 'place' },
  { id: '4', name: 'العقبة', icon: 'beach-access' },
  { id: '5', name: 'البتراء', icon: 'account-balance' },
  { id: '6', name: 'الكرك', icon: 'castle' },
];

const QUICK_PLACES_EN = [
  { id: '1', name: 'Amman', icon: 'location-city' },
  { id: '2', name: 'Irbid', icon: 'place' },
  { id: '3', name: 'Zarqa', icon: 'place' },
  { id: '4', name: 'Aqaba', icon: 'beach-access' },
  { id: '5', name: 'Petra', icon: 'account-balance' },
  { id: '6', name: 'Karak', icon: 'castle' },
];

export default function HomeScreen() {
  const { user } = useAuth();
  const { t, language, toggleLanguage, isRTL } = useLanguage();
  const { selectedService, setSelectedService, setPickup, setDropoff } = useRide();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(30)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerAnim, { toValue: 1, tension: 70, friction: 10, useNativeDriver: true }),
      Animated.timing(contentOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(contentAnim, { toValue: 0, tension: 60, friction: 12, useNativeDriver: true }),
    ]).start();
  }, []);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? t('goodMorning') : hour < 18 ? t('goodAfternoon') : t('goodEvening');
  const places = language === 'ar' ? QUICK_PLACES_AR : QUICK_PLACES_EN;
  const governorates = CONFIG.GOVERNORATES;

  const handleQuickPlace = (place: (typeof places)[0]) => {
    const gov =
      governorates.find((g) =>
        (language === 'ar' ? g.nameAr : g.nameEn).includes(place.name.split(' ')[0])
      ) || governorates[0];
    setPickup({
      name: language === 'ar' ? 'موقعك الحالي' : 'Your Location',
      nameEn: 'Your Location',
      lat: CONFIG.MAP_CENTER.latitude,
      lng: CONFIG.MAP_CENTER.longitude,
    });
    setDropoff({ name: gov.nameAr, nameEn: gov.nameEn, lat: gov.lat, lng: gov.lng });
    router.push('/booking');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      {/* ── MAP ── */}
      <View style={styles.mapContainer}>
        <TariqMapView style={styles.map} initialRegion={CONFIG.MAP_CENTER} showsUserLocation>
          <Marker
            coordinate={{ latitude: CONFIG.MAP_CENTER.latitude, longitude: CONFIG.MAP_CENTER.longitude }}
            title={t('currentLocation')}
          >
            <View style={styles.myMarker}>
              <MaterialIcons name="my-location" size={16} color="#FFF" />
            </View>
          </Marker>
          {[
            { lat: 31.960, lng: 35.920 },
            { lat: 31.948, lng: 35.905 },
            { lat: 31.970, lng: 35.895 },
          ].map((pos, i) => (
            <Marker key={i} coordinate={{ latitude: pos.lat, longitude: pos.lng }}>
              <View style={styles.captainMarker}>
                <MaterialIcons name="directions-car" size={13} color={Colors.gold} />
              </View>
            </Marker>
          ))}
        </TariqMapView>
        {/* Deep red gradient fade over map bottom */}
        <LinearGradient
          colors={['transparent', 'rgba(13,0,2,0.6)', Colors.background]}
          style={styles.mapFade}
        />
      </View>

      {/* ── SCROLLABLE OVERLAY ── */}
      <ScrollView
        style={styles.overlay}
        contentContainerStyle={{ paddingBottom: 110, paddingTop: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            { flexDirection: isRTL ? 'row-reverse' : 'row' },
            { opacity: headerAnim, transform: [{ scale: headerAnim }] },
          ]}
        >
          {/* Logo + Greeting */}
          <View style={[styles.headerLeft, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
            <View style={[styles.greetingRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                <Text style={styles.greeting}>{greeting}،</Text>
                <Text style={styles.userName}>
                  {user ? (user.username ?? user.email?.split('@')[0] ?? 'طريقي') : 'طريقي'}
                </Text>
              </View>
            </View>
          </View>

          {/* Actions */}
          <View style={styles.headerRight}>
            <Pressable style={styles.headerBtn} onPress={toggleLanguage}>
              <Text style={styles.headerBtnText}>{language === 'ar' ? 'EN' : 'ع'}</Text>
            </Pressable>
            <Pressable style={styles.headerBtn} onPress={() => {}}>
              <MaterialIcons name="notifications-none" size={20} color={Colors.gold} />
              <View style={styles.notifDot} />
            </Pressable>
          </View>
        </Animated.View>

        {/* Ad Banner */}
        <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentAnim }] }}>
          <AdBanner />
        </Animated.View>

        {/* Search / CTA */}
        <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentAnim }] }}>
          <Pressable style={styles.searchBar} onPress={() => router.push('/booking')}>
            <View style={styles.searchIconBox}>
              <MaterialIcons name="search" size={20} color="#FFF" />
            </View>
            <Text style={[styles.searchPlaceholder, { textAlign: isRTL ? 'right' : 'left' }]}>
              {t('searchDestination')}
            </Text>
            <MaterialIcons
              name={isRTL ? 'arrow-back-ios' : 'arrow-forward-ios'}
              size={15}
              color={Colors.gold}
            />
          </Pressable>
        </Animated.View>

        {/* Services */}
        <Animated.View
          style={[styles.section, { opacity: contentOpacity, transform: [{ translateY: contentAnim }] }]}
        >
          <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionTitle}>{t('ourServices')}</Text>
          </View>
          <View style={styles.servicesRow}>
            {SERVICES.map((svc) => (
              <ServiceCard
                key={svc.type}
                type={svc.type}
                title={t(svc.titleKey)}
                description={t(svc.descKey)}
                icon={svc.icon}
                isSelected={selectedService === svc.type}
                onPress={() => setSelectedService(svc.type)}
                isRTL={isRTL}
              />
            ))}
          </View>
        </Animated.View>

        {/* Popular Destinations */}
        <Animated.View
          style={[styles.section, { opacity: contentOpacity, transform: [{ translateY: contentAnim }] }]}
        >
          <View style={[styles.sectionHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={styles.sectionDot} />
            <Text style={styles.sectionTitle}>
              {language === 'ar' ? 'وجهات شائعة' : 'Popular Destinations'}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.placesScroll}
            contentContainerStyle={[
              styles.placesRow,
              { flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
          >
            {places.map((p) => (
              <Pressable
                key={p.id}
                style={({ pressed }) => [styles.placeChip, pressed && styles.placeChipPressed]}
                onPress={() => handleQuickPlace(p)}
              >
                <View style={styles.placeIconBox}>
                  <MaterialIcons name={p.icon as any} size={14} color="#FFF" />
                </View>
                <Text style={styles.placeText}>{p.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Price Info Card */}
        <Animated.View
          style={[styles.priceCard, { opacity: contentOpacity, transform: [{ translateY: contentAnim }] }]}
        >
          <LinearGradient
            colors={['#2A0008', '#1A0005']}
            style={styles.priceGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={[styles.priceRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <View style={[styles.priceInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                <Text style={styles.priceLabel}>
                  {language === 'ar' ? 'الأسعار تبدأ من' : 'Prices starting from'}
                </Text>
                <View style={[styles.priceValueRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                  <Text style={styles.priceValue}>1.5</Text>
                  <Text style={styles.priceCurrency}>
                    {language === 'ar' ? ' د.أ' : ' JOD'}
                  </Text>
                </View>
                <Text style={styles.priceSub}>
                  {language === 'ar' ? 'شامل جميع الرسوم' : 'All fees included'}
                </Text>
              </View>
              <View style={styles.priceRightCol}>
                <View style={styles.priceIconBox}>
                  <MaterialIcons name="attach-money" size={26} color={Colors.gold} />
                </View>
                <Pressable
                  style={styles.bookNowBtn}
                  onPress={() => router.push('/booking')}
                >
                  <Text style={styles.bookNowText}>
                    {language === 'ar' ? 'احجز' : 'Book'}
                  </Text>
                  <MaterialIcons
                    name={isRTL ? 'arrow-back' : 'arrow-forward'}
                    size={14}
                    color="#FFF"
                  />
                </Pressable>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        {/* Stats Row */}
        <Animated.View
          style={[styles.statsRow, { opacity: contentOpacity, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          {[
            { icon: 'directions-car', value: '500+', label: language === 'ar' ? 'كابتن' : 'Captains' },
            { icon: 'location-on', value: '12', label: language === 'ar' ? 'محافظة' : 'Governorates' },
            { icon: 'star', value: '4.9', label: language === 'ar' ? 'تقييم' : 'Rating' },
          ].map((stat, i) => (
            <View key={i} style={styles.statCard}>
              <MaterialIcons name={stat.icon as any} size={22} color={Colors.red} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // Map
  mapContainer: { position: 'absolute', top: 0, left: 0, right: 0, height: '42%' },
  map: { flex: 1 },
  mapFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 100 },
  myMarker: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: '#FFF',
    shadowColor: Colors.red, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 10, elevation: 8,
  },
  captainMarker: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.surfaceCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.gold,
    ...Shadows.card,
  },

  // Overlay
  overlay: { flex: 1, marginTop: '40%' },

  // Header
  header: {
    justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
  },
  headerLeft: { gap: 2, flex: 1 },
  greetingRow: { alignItems: 'center', gap: Spacing.sm },
  greeting: { color: Colors.textSecondary, fontSize: Typography.sizes.xs },
  userName: { color: Colors.textPrimary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.bold },
  headerRight: { flexDirection: 'row', gap: Spacing.sm },
  headerBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: Colors.surfaceCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(204,16,32,0.3)',
  },
  headerBtnText: { color: Colors.gold, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.bold },
  notifDot: {
    position: 'absolute', top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: Colors.red, borderWidth: 1.5, borderColor: Colors.background,
  },

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    marginHorizontal: Spacing.base, marginTop: Spacing.sm,
    backgroundColor: Colors.surfaceCard, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    borderWidth: 1.5, borderColor: 'rgba(204,16,32,0.35)',
    minHeight: 54,
    shadowColor: Colors.red, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 5,
  },
  searchIconBox: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center',
  },
  searchPlaceholder: { flex: 1, color: Colors.textMuted, fontSize: Typography.sizes.base },

  // Section
  section: { paddingHorizontal: Spacing.base, marginTop: Spacing.lg, gap: Spacing.md },
  sectionHeader: { alignItems: 'center', gap: Spacing.sm },
  sectionDot: {
    width: 4, height: 18, borderRadius: 2, backgroundColor: Colors.red,
  },
  sectionTitle: { color: Colors.textPrimary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.bold, flex: 1 },

  servicesRow: { flexDirection: 'row', gap: Spacing.sm },

  // Places
  placesScroll: { marginHorizontal: -Spacing.base },
  placesRow: { gap: Spacing.sm, paddingHorizontal: Spacing.base, paddingVertical: 4 },
  placeChip: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surfaceCard, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: 'rgba(204,16,32,0.3)', minHeight: 40,
  },
  placeChipPressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  placeIconBox: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.red, alignItems: 'center', justifyContent: 'center',
  },
  placeText: { color: Colors.textPrimary, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.medium },

  // Price Card
  priceCard: {
    marginHorizontal: Spacing.base, marginTop: Spacing.base,
    borderRadius: Radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(204,16,32,0.3)',
    ...Shadows.red,
  },
  priceGradient: { padding: Spacing.base },
  priceRow: { alignItems: 'center', gap: Spacing.md },
  priceInfo: { flex: 1, gap: 4 },
  priceLabel: { color: Colors.textSecondary, fontSize: Typography.sizes.sm },
  priceValueRow: { alignItems: 'baseline', gap: 2 },
  priceValue: { color: Colors.textPrimary, fontSize: 30, fontWeight: '800' },
  priceCurrency: { color: Colors.gold, fontSize: Typography.sizes.lg, fontWeight: Typography.weights.bold },
  priceSub: { color: Colors.textMuted, fontSize: Typography.sizes.xs },
  priceRightCol: { alignItems: 'center', gap: Spacing.sm },
  priceIconBox: {
    width: 50, height: 50, borderRadius: Radius.md,
    backgroundColor: Colors.goldFaint, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderGold,
  },
  bookNowBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.red, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
  },
  bookNowText: { color: '#FFF', fontSize: Typography.sizes.sm, fontWeight: Typography.weights.bold },

  // Stats
  statsRow: {
    marginHorizontal: Spacing.base, marginTop: Spacing.base, gap: Spacing.sm,
  },
  statCard: {
    flex: 1, backgroundColor: Colors.surfaceCard, borderRadius: Radius.md,
    padding: Spacing.md, alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: 'rgba(204,16,32,0.2)',
  },
  statValue: { color: Colors.textPrimary, fontSize: Typography.sizes.lg, fontWeight: Typography.weights.bold },
  statLabel: { color: Colors.textSecondary, fontSize: Typography.sizes.xs },
});
