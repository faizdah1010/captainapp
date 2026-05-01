import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, Animated, KeyboardAvoidingView,
  Platform, TextInput, FlatList, Easing,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { TariqMapView, Marker, Polyline } from '@/components/ui/TariqMap';
import { useLanguage } from '@/hooks/useLanguage';
import { useRide } from '@/hooks/useRide';
import { useAlert } from '@/template';
import { sendRideNotification } from '@/services/notificationService';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { CONFIG } from '@/constants/config';
import { RatingModal } from '@/components/feature/RatingModal';

// ── Geo helpers ───────────────────────────────────────────────────────────────
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const STATUS_COLORS: Record<string, string> = {
  searching: Colors.warning,
  found: Colors.success,
  arriving: Colors.gold,
  inProgress: Colors.primary,
  completed: Colors.success,
};

export default function TrackingScreen() {
  const { t, language, isRTL } = useLanguage();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    rideStatus, captain, chatMessages, sendMessage, cancelRide,
    pickup, dropoff, saveRating, lastCompletedRideId,
  } = useRide();

  const lang = language as 'ar' | 'en';

  // Captain starting position
  const startLat = captain?.lat ?? CONFIG.MOCK_CAPTAIN.lat;
  const startLng = captain?.lng ?? CONFIG.MOCK_CAPTAIN.lng;

  const destLat = pickup?.lat ?? CONFIG.MAP_CENTER.latitude;
  const destLng = pickup?.lng ?? CONFIG.MAP_CENTER.longitude;
  const finalLat = dropoff?.lat ?? destLat - 0.02;
  const finalLng = dropoff?.lng ?? destLng - 0.015;

  // Captain live position (updated from DB via RideContext)
  const [captainPos, setCaptainPos] = useState({ lat: startLat, lng: startLng });
  const [carRotation, setCarRotation] = useState(0);
  const [traveledPath, setTraveledPath] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(0);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const flatListRef = useRef<FlatList>(null);

  // Animated values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const carScaleAnim = useRef(new Animated.Value(1)).current;
  const etaBarWidth = useRef(new Animated.Value(0.02)).current;
  const bottomSlide = useRef(new Animated.Value(120)).current;

  // ── Update captain position from context (real GPS) ───────────────────────
  useEffect(() => {
    if (!captain) return;
    const newLat = captain.lat;
    const newLng = captain.lng;

    if (newLat !== captainPos.lat || newLng !== captainPos.lng) {
      const rot = bearing(captainPos.lat, captainPos.lng, newLat, newLng);
      setCarRotation(rot);

      setTraveledPath((prev) => [
        ...prev.slice(-40),
        { latitude: newLat, longitude: newLng },
      ]);

      setCaptainPos({ lat: newLat, lng: newLng });

      Animated.sequence([
        Animated.timing(carScaleAnim, { toValue: 1.2, duration: 150, useNativeDriver: true }),
        Animated.spring(carScaleAnim, { toValue: 1, tension: 200, friction: 6, useNativeDriver: true }),
      ]).start();

      const targetLat = (rideStatus === 'arriving' || rideStatus === 'found') ? destLat : finalLat;
      const targetLng = (rideStatus === 'arriving' || rideStatus === 'found') ? destLng : finalLng;
      const dist = haversineKm(newLat, newLng, targetLat, targetLng);
      setDistanceKm(dist);
      setEtaSeconds(Math.round((dist / 40) * 3600));

      const totalDist = (rideStatus === 'arriving' || rideStatus === 'found')
        ? haversineKm(startLat, startLng, destLat, destLng)
        : haversineKm(destLat, destLng, finalLat, finalLng);
      const progress = Math.max(0.02, Math.min(1, 1 - dist / Math.max(totalDist, 0.1)));
      Animated.timing(etaBarWidth, { toValue: progress, duration: 800, useNativeDriver: false }).start();
    }
  }, [captain?.lat, captain?.lng]);

  // ── Pulse animation ─────────────────────────────────────────────────────────
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.35, duration: 700, useNativeDriver: true, easing: Easing.out(Easing.ease) }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true, easing: Easing.in(Easing.ease) }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // ── Bottom sheet entrance ───────────────────────────────────────────────────
  useEffect(() => {
    Animated.spring(bottomSlide, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }).start();
  }, []);

  // ── Completion → show rating modal ────────────────────────────────────────
  useEffect(() => {
    if (rideStatus === 'completed') {
      const timer = setTimeout(() => setShowRatingModal(true), 800);
      return () => clearTimeout(timer);
    }
  }, [rideStatus]);

  const handleRatingSubmit = async (rating: number, review: string) => {
    setShowRatingModal(false);
    if (lastCompletedRideId) {
      await saveRating(lastCompletedRideId, rating, review);
    }
    router.replace('/(tabs)');
  };

  const handleRatingSkip = () => {
    setShowRatingModal(false);
    router.replace('/(tabs)');
  };

  // ── Map region ──────────────────────────────────────────────────────────────
  const mapRegion = {
    latitude: captainPos.lat,
    longitude: captainPos.lng,
    latitudeDelta: 0.03,
    longitudeDelta: 0.03,
  };

  const routeLine = captain ? [
    { latitude: captainPos.lat, longitude: captainPos.lng },
    {
      latitude: (rideStatus === 'arriving' || rideStatus === 'found') ? destLat : finalLat,
      longitude: (rideStatus === 'arriving' || rideStatus === 'found') ? destLng : finalLng,
    },
  ] : [];

  // ── ETA formatting ───────────────────────────────────────────────────────────
  const etaMin = Math.ceil(etaSeconds / 60);
  const etaDisplay =
    etaSeconds > 60
      ? `${etaMin} ${language === 'ar' ? 'د' : 'min'}`
      : `< 1 ${language === 'ar' ? 'د' : 'min'}`;
  const distDisplay = distanceKm < 1
    ? `${Math.round(distanceKm * 1000)} ${language === 'ar' ? 'م' : 'm'}`
    : `${distanceKm.toFixed(1)} ${language === 'ar' ? 'كم' : 'km'}`;

  const statusLabel =
    rideStatus === 'searching' ? t('lookingForCaptain')
    : rideStatus === 'found' ? t('captainFound')
    : rideStatus === 'arriving' ? (language === 'ar' ? 'الكابتن في الطريق' : 'Captain en route')
    : rideStatus === 'inProgress' ? t('rideInProgress')
    : rideStatus === 'completed' ? t('youArrived')
    : '';

  const dotColor = STATUS_COLORS[rideStatus] ?? Colors.gold;

  const unreadCount = chatMessages.filter((m) => !m.isMe).length;

  const handleSend = () => {
    if (messageInput.trim()) {
      sendMessage(messageInput.trim());
      setMessageInput('');
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    }
  };

  const handleCancel = () => {
    showAlert(
      language === 'ar' ? 'إلغاء الرحلة' : 'Cancel Ride',
      language === 'ar' ? 'هل تريد إلغاء الرحلة؟' : 'Are you sure you want to cancel?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: language === 'ar' ? 'نعم، إلغاء' : 'Yes, Cancel',
          style: 'destructive',
          onPress: () => { cancelRide(); router.replace('/(tabs)'); },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>

      <RatingModal
        visible={showRatingModal}
        captainName={captain ? (language === 'ar' ? captain.name : captain.nameEn) : ''}
        language={lang}
        isRTL={isRTL}
        onSubmit={handleRatingSubmit}
        onSkip={handleRatingSkip}
      />

      {/* Header overlay */}
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={Colors.gold} />
        </Pressable>

        <View style={[styles.statusBadge, { borderColor: dotColor + '66' }]}>
          <Animated.View style={[styles.dotRing, { borderColor: dotColor, transform: [{ scale: pulseAnim }] }]} />
          <View style={[styles.dot, { backgroundColor: dotColor }]} />
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>

        <Pressable style={styles.iconBtn} onPress={() => setShowChat(!showChat)}>
          <MaterialIcons name="chat" size={22} color={Colors.gold} />
          {unreadCount > 0 ? (
            <View style={styles.chatBadge}>
              <Text style={styles.chatBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <TariqMapView style={styles.map} region={mapRegion} showsUserLocation>

          {/* Route line */}
          {routeLine.length > 1 ? (
            <Polyline
              coordinates={routeLine}
              strokeColor={Colors.gold}
              strokeWidth={4}
              lineDashPattern={[8, 4]}
            />
          ) : null}

          {/* Traveled path */}
          {traveledPath.length > 1 ? (
            <Polyline
              coordinates={traveledPath}
              strokeColor={Colors.goldDim}
              strokeWidth={3}
            />
          ) : null}

          {/* Captain marker */}
          {captain ? (
            <Marker coordinate={{ latitude: captainPos.lat, longitude: captainPos.lng }}>
              <Animated.View style={{ transform: [{ scale: carScaleAnim }] }}>
                <View style={[styles.carMarker, { transform: [{ rotate: `${carRotation}deg` }] }]}>
                  <MaterialCommunityIcons name="car-sports" size={20} color={Colors.gold} />
                </View>
              </Animated.View>
            </Marker>
          ) : null}

          {/* Pickup marker */}
          {pickup ? (
            <Marker coordinate={{ latitude: destLat, longitude: destLng }}>
              <View style={styles.pickupMarker}>
                <Animated.View style={[styles.pickupRing, { transform: [{ scale: pulseAnim }] }]} />
                <MaterialIcons name="person-pin-circle" size={28} color={Colors.success} />
              </View>
            </Marker>
          ) : null}

          {/* Dropoff marker */}
          {dropoff ? (
            <Marker coordinate={{ latitude: dropoff.lat, longitude: dropoff.lng }}>
              <View style={styles.destMarker}>
                <MaterialIcons name="place" size={26} color={Colors.primary} />
              </View>
            </Marker>
          ) : null}
        </TariqMapView>

        {/* ETA overlay */}
        {captain && rideStatus !== 'searching' ? (
          <View style={styles.mapEtaOverlay}>
            <View style={styles.mapEtaCard}>
              <View style={styles.mapEtaRow}>
                <MaterialIcons name="schedule" size={16} color={Colors.gold} />
                <Text style={styles.mapEtaTime}>{etaDisplay}</Text>
                <View style={styles.mapEtaDot} />
                <MaterialIcons name="straight" size={14} color={Colors.textMuted} />
                <Text style={styles.mapEtaDist}>{distDisplay}</Text>
              </View>
              <View style={styles.etaBarBg}>
                <Animated.View
                  style={[
                    styles.etaBarFill,
                    { width: etaBarWidth.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) },
                  ]}
                />
              </View>
            </View>
          </View>
        ) : null}
      </View>

      {/* Bottom sheet */}
      <Animated.View
        style={[
          styles.bottomSheet,
          { paddingBottom: insets.bottom + Spacing.base, transform: [{ translateY: bottomSlide }] },
        ]}
      >
        {!showChat ? (
          <>
            {captain ? (
              <CaptainInfoCard
                captain={captain}
                etaDisplay={etaDisplay}
                distDisplay={distDisplay}
                rideStatus={rideStatus}
                language={language}
                isRTL={isRTL}
                onChat={() => setShowChat(true)}
                onCall={() =>
                  showAlert(
                    language === 'ar' ? 'الاتصال بالكابتن' : 'Calling Captain',
                    captain.name
                  )
                }
              />
            ) : (
              <SearchingBox pulseAnim={pulseAnim} language={language} t={t} />
            )}

            {rideStatus !== 'completed' ? (
              <Pressable style={styles.cancelBtn} onPress={handleCancel}>
                <MaterialIcons name="close" size={16} color={Colors.error} />
                <Text style={styles.cancelText}>{t('cancelRide')}</Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.chatContainer}
          >
            <View style={[styles.chatHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Pressable style={styles.iconBtn} onPress={() => setShowChat(false)}>
                <MaterialIcons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={20} color={Colors.gold} />
              </Pressable>
              <View style={{ flex: 1, alignItems: 'center' }}>
                <Text style={styles.chatTitle}>
                  {captain ? (language === 'ar' ? captain.name : captain.nameEn) : t('chatWithCaptain')}
                </Text>
                {captain ? (
                  <Text style={styles.chatSubtitle}>{captain.car} · {captain.plate}</Text>
                ) : null}
              </View>
              <View style={{ width: 44 }} />
            </View>
            <FlatList
              ref={flatListRef}
              data={chatMessages}
              keyExtractor={(item) => item.id}
              style={styles.chatList}
              contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md, paddingBottom: Spacing.sm }}
              renderItem={({ item }) => (
                <View
                  style={[
                    styles.bubble,
                    item.isMe ? styles.bubbleMe : styles.bubbleThem,
                    {
                      alignSelf: item.isMe
                        ? isRTL ? 'flex-start' : 'flex-end'
                        : isRTL ? 'flex-end' : 'flex-start',
                    },
                  ]}
                >
                  <Text style={[styles.bubbleText, { textAlign: isRTL ? 'right' : 'left' }]}>
                    {item.text}
                  </Text>
                  <Text style={[styles.bubbleTime, { textAlign: isRTL ? 'left' : 'right' }]}>
                    {item.timestamp.getHours().toString().padStart(2, '0')}:
                    {item.timestamp.getMinutes().toString().padStart(2, '0')}
                  </Text>
                </View>
              )}
              ListEmptyComponent={() => (
                <View style={{ alignItems: 'center', paddingTop: 20, gap: 8 }}>
                  <MaterialIcons name="chat-bubble-outline" size={40} color={Colors.redDim} />
                  <Text style={{ color: Colors.textMuted, fontSize: Typography.sizes.sm }}>
                    {language === 'ar' ? 'لا توجد رسائل بعد' : 'No messages yet'}
                  </Text>
                </View>
              )}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
            />
            <View style={[styles.chatInput, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <TextInput
                value={messageInput}
                onChangeText={setMessageInput}
                placeholder={t('typeMessage')}
                placeholderTextColor={Colors.textMuted}
                style={[styles.msgInput, { textAlign: isRTL ? 'right' : 'left' }]}
                multiline
                onSubmitEditing={handleSend}
              />
              <Pressable
                style={({ pressed }) => [styles.sendBtn, pressed && { opacity: 0.8 }]}
                onPress={handleSend}
              >
                <MaterialIcons name="send" size={20} color={Colors.textOnGold} />
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        )}
      </Animated.View>
    </View>
  );
}

// ── Searching Box ─────────────────────────────────────────────────────────────
function SearchingBox({ pulseAnim, language, t }: { pulseAnim: Animated.Value; language: string; t: (k: string) => string }) {
  return (
    <View style={styles.searchingBox}>
      <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
        <View style={styles.searchingIcon}>
          <MaterialIcons name="search" size={36} color={Colors.gold} />
        </View>
      </Animated.View>
      <Text style={styles.searchingTitle}>{t('lookingForCaptain')}</Text>
      <Text style={styles.searchingSubtitle}>
        {language === 'ar' ? 'جاري البحث عن أقرب كابتن...' : 'Finding the nearest captain...'}
      </Text>
    </View>
  );
}

// ── Captain Info Card ────────────────────────────────────────────────────────
function CaptainInfoCard({
  captain, etaDisplay, distDisplay, rideStatus, language, isRTL, onChat, onCall,
}: {
  captain: any; etaDisplay: string; distDisplay: string;
  rideStatus: string; language: string; isRTL: boolean;
  onChat: () => void; onCall: () => void;
}) {
  const phaseLabel = rideStatus === 'inProgress'
    ? (language === 'ar' ? 'في الطريق للوجهة' : 'Heading to destination')
    : (language === 'ar' ? 'في الطريق إليك' : 'Heading to you');

  const phaseColor = rideStatus === 'inProgress' ? Colors.primary : Colors.success;

  return (
    <View style={styles.captainCard}>
      {/* Phase row */}
      <View style={[styles.phaseRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.phaseIcon, { backgroundColor: phaseColor + '20' }]}>
          <MaterialIcons
            name={rideStatus === 'inProgress' ? 'flag' : 'person-pin'}
            size={14}
            color={phaseColor}
          />
        </View>
        <Text style={[styles.phaseLabel, { color: phaseColor }]}>{phaseLabel}</Text>
      </View>

      {/* Captain main row */}
      <View style={[styles.captainRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={styles.captainAvatar}>
          <MaterialIcons name="person" size={30} color={Colors.gold} />
        </View>

        <View style={[styles.captainInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Text style={styles.captainName}>{language === 'ar' ? captain.name : captain.nameEn}</Text>
          <View style={[styles.ratingRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <MaterialIcons name="star" size={13} color={Colors.gold} />
            <Text style={styles.ratingText}>{Number(captain.rating).toFixed(1)}</Text>
            <Text style={styles.tripsText}>· {captain.trips} {language === 'ar' ? 'رحلة' : 'trips'}</Text>
          </View>
          <Text style={styles.carText}>{captain.car} · {captain.plate}</Text>
        </View>

        <View style={styles.etaBox}>
          <Text style={styles.etaTime}>{etaDisplay}</Text>
          <Text style={styles.etaDist}>{distDisplay}</Text>
        </View>
      </View>

      {/* Action buttons */}
      <View style={[styles.captainActions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.chatBtnStyle, pressed && { opacity: 0.8 }]}
          onPress={onChat}
        >
          <MaterialIcons name="chat-bubble-outline" size={18} color={Colors.gold} />
          <Text style={styles.actionBtnText}>{language === 'ar' ? 'محادثة' : 'Chat'}</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionBtn, styles.callBtn, pressed && { opacity: 0.8 }]}
          onPress={onCall}
        >
          <MaterialIcons name="call" size={18} color={Colors.textOnGold} />
          <Text style={[styles.actionBtnText, { color: Colors.textOnGold }]}>
            {language === 'ar' ? 'اتصال' : 'Call'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surface + 'EE',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border, ...Shadows.card,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.surface + 'EE', borderRadius: Radius.full,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderWidth: 1, ...Shadows.card,
  },
  dotRing: {
    position: 'absolute', width: 14, height: 14, borderRadius: 7,
    borderWidth: 1.5, opacity: 0.5,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: {
    color: Colors.textPrimary, fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.semiBold,
  },
  chatBadge: {
    position: 'absolute', top: 6, right: 6,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 3,
  },
  chatBadgeText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  mapContainer: { flex: 1 },
  map: { flex: 1 },
  carMarker: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.surfaceCard,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.gold, ...Shadows.gold,
  },
  pickupMarker: { alignItems: 'center', justifyContent: 'center' },
  pickupRing: {
    position: 'absolute', width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: Colors.success + '66',
  },
  destMarker: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: Colors.redFaint,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.primary,
  },
  mapEtaOverlay: {
    position: 'absolute', bottom: 16, left: Spacing.base, right: Spacing.base,
    alignItems: 'center',
  },
  mapEtaCard: {
    backgroundColor: Colors.surface + 'F0',
    borderRadius: Radius.xl, paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderGold, gap: Spacing.sm,
    minWidth: 200, ...Shadows.gold,
  },
  mapEtaRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, justifyContent: 'center',
  },
  mapEtaTime: {
    color: Colors.gold, fontSize: Typography.sizes.base, fontWeight: Typography.weights.bold,
  },
  mapEtaDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: Colors.textMuted },
  mapEtaDist: {
    color: Colors.textSecondary, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.medium,
  },
  etaBarBg: { height: 3, borderRadius: 2, backgroundColor: Colors.border, overflow: 'hidden' },
  etaBarFill: { height: 3, borderRadius: 2, backgroundColor: Colors.gold },
  bottomSheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    padding: Spacing.base, gap: Spacing.base,
    borderTopWidth: 1, borderTopColor: Colors.borderGold, ...Shadows.deep,
  },
  captainCard: {
    backgroundColor: Colors.surfaceCard, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.borderGold, overflow: 'hidden', ...Shadows.gold,
  },
  phaseRow: {
    alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.base, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  phaseIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  phaseLabel: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.semiBold },
  captainRow: {
    alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.base, paddingBottom: Spacing.base,
  },
  captainAvatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colors.goldFaint, borderWidth: 2, borderColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center',
  },
  captainInfo: { flex: 1, gap: 3 },
  captainName: {
    color: Colors.textPrimary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.bold,
  },
  ratingRow: { gap: Spacing.xs, alignItems: 'center' },
  ratingText: { color: Colors.gold, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.semiBold },
  tripsText: { color: Colors.textSecondary, fontSize: Typography.sizes.sm },
  carText: { color: Colors.textSecondary, fontSize: Typography.sizes.xs },
  etaBox: {
    alignItems: 'center', backgroundColor: Colors.goldFaint,
    borderRadius: Radius.md, padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.borderGold, minWidth: 68,
  },
  etaTime: { color: Colors.gold, fontSize: Typography.sizes.lg, fontWeight: Typography.weights.bold },
  etaDist: { color: Colors.textSecondary, fontSize: Typography.sizes.xs, marginTop: 2 },
  captainActions: {
    borderTopWidth: 1, borderTopColor: Colors.border, gap: Spacing.sm, padding: Spacing.sm,
  },
  actionBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.sm, borderRadius: Radius.lg, minHeight: 44,
  },
  chatBtnStyle: {
    backgroundColor: Colors.goldFaint, borderWidth: 1, borderColor: Colors.borderGold,
  },
  callBtn: { backgroundColor: Colors.gold },
  actionBtnText: {
    color: Colors.gold, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.bold,
  },
  searchingBox: {
    alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md,
  },
  searchingIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: Colors.goldFaint, borderWidth: 1.5, borderColor: Colors.borderGold,
    alignItems: 'center', justifyContent: 'center',
  },
  searchingTitle: {
    color: Colors.textPrimary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.bold,
  },
  searchingSubtitle: { color: Colors.textSecondary, fontSize: Typography.sizes.sm },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.error + '66', minHeight: 48,
  },
  cancelText: { color: Colors.error, fontSize: Typography.sizes.base, fontWeight: Typography.weights.semiBold },
  chatContainer: { flex: 1, minHeight: 300 },
  chatHeader: {
    alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: Spacing.md, borderBottomWidth: 1, borderBottomColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  chatTitle: {
    color: Colors.textPrimary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.bold,
  },
  chatSubtitle: { color: Colors.textMuted, fontSize: Typography.sizes.xs, marginTop: 2 },
  chatList: { flex: 1, maxHeight: 220 },
  bubble: { maxWidth: '78%', borderRadius: Radius.lg, padding: Spacing.md, gap: 4 },
  bubbleMe: { backgroundColor: Colors.goldMedium, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: Colors.surfaceElevated, borderBottomLeftRadius: 4 },
  bubbleText: { color: Colors.textPrimary, fontSize: Typography.sizes.base },
  bubbleTime: { color: Colors.textMuted, fontSize: Typography.sizes.xs },
  chatInput: {
    alignItems: 'flex-end', gap: Spacing.sm, marginTop: Spacing.sm,
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.xl, padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  msgInput: {
    flex: 1, color: Colors.textPrimary, fontSize: Typography.sizes.base,
    maxHeight: 100, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.gold,
    alignItems: 'center', justifyContent: 'center', ...Shadows.gold,
  },
});
