import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/hooks/useLanguage';
import { useRide, RideRecord } from '@/hooks/useRide';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';

const SERVICE_ICONS = { regular: 'directions-car', ladies: 'face', express: 'local-shipping' } as const;
const SERVICE_LABELS_AR = { regular: 'طريق عادي', ladies: 'طريق نسائي', express: 'إكسبرس' };
const SERVICE_LABELS_EN = { regular: 'Regular', ladies: 'Ladies', express: 'Express' };

export default function RidesScreen() {
  const { t, language, isRTL } = useLanguage();
  const { rideHistory, isLoadingHistory, fetchRideHistory } = useRide();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<'all' | 'completed' | 'cancelled'>('all');

  // Load from DB on mount
  React.useEffect(() => { fetchRideHistory(); }, []);

  const filtered = filter === 'all' ? rideHistory : rideHistory.filter((r) => r.status === filter);

  const renderRide = ({ item }: { item: RideRecord }) => {
    const serviceLabels = language === 'ar' ? SERVICE_LABELS_AR : SERVICE_LABELS_EN;
    return (
      <Pressable style={styles.rideCard}>
        <View style={[styles.rideHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={[styles.serviceIcon, item.status === 'cancelled' && styles.cancelledIcon]}>
            <MaterialIcons
              name={SERVICE_ICONS[item.service]}
              size={20}
              color={item.status === 'completed' ? Colors.gold : Colors.textMuted}
            />
          </View>
          <View style={[styles.rideHeaderInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Text style={styles.serviceLabel}>{serviceLabels[item.service]}</Text>
            <Text style={styles.rideDate}>{item.date}</Text>
          </View>
          <View style={styles.priceStatus}>
            <Text style={[styles.ridePrice, item.status === 'cancelled' && { color: Colors.textMuted }]}>
              {item.status === 'completed' ? `${item.price.toFixed(2)} ${language === 'ar' ? 'د.أ' : 'JOD'}` : '—'}
            </Text>
            <View style={[styles.statusBadge, item.status === 'cancelled' && styles.cancelledBadge]}>
              <Text style={[styles.statusText, item.status === 'cancelled' && styles.cancelledText]}>
                {item.status === 'completed' ? t('completed') : t('cancelled')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.routeSection}>
          <View style={styles.routeDot}>
            <View style={styles.dotGreen} />
            <View style={styles.routeLine} />
            <View style={styles.dotGold} />
          </View>
          <View style={[styles.routeLabels, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
            <Text style={styles.routeFrom} numberOfLines={1}>
              {language === 'ar' ? item.from.name : item.from.nameEn}
            </Text>
            <Text style={styles.routeTo} numberOfLines={1}>
              {language === 'ar' ? item.to.name : item.to.nameEn}
            </Text>
          </View>
        </View>

        {item.status === 'completed' && item.captainName ? (
          <View style={[styles.captainRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <MaterialIcons name="person" size={14} color={Colors.textMuted} />
            <Text style={styles.captainName}>{item.captainName}</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
        <Text style={styles.title}>{t('myRides')}</Text>
        <Text style={styles.count}>{filtered.length} {language === 'ar' ? 'رحلة' : 'rides'}</Text>
      </View>

      {/* Filter Tabs */}
      <View style={[styles.filterRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {(['all', 'completed', 'cancelled'] as const).map((f) => (
          <Pressable
            key={f}
            style={[styles.filterBtn, filter === f && styles.filterActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterActiveText]}>
              {f === 'all' ? (language === 'ar' ? 'الكل' : 'All')
                : f === 'completed' ? t('completed')
                : t('cancelled')}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={renderRide}
        contentContainerStyle={{ padding: Spacing.base, gap: Spacing.md, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="directions-car" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {isLoadingHistory ? (language === 'ar' ? 'جاري التحميل...' : 'Loading...') : t('noRides')}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.base, paddingTop: Spacing.base, paddingBottom: Spacing.sm, gap: 2 },
  title: { color: Colors.textPrimary, fontSize: Typography.sizes.xxl, fontWeight: Typography.weights.bold },
  count: { color: Colors.textSecondary, fontSize: Typography.sizes.sm },
  filterRow: { paddingHorizontal: Spacing.base, marginBottom: Spacing.base, gap: Spacing.sm },
  filterBtn: {
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border, minHeight: 40,
    justifyContent: 'center',
  },
  filterActive: { backgroundColor: Colors.goldFaint, borderColor: Colors.gold },
  filterText: { color: Colors.textSecondary, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.medium },
  filterActiveText: { color: Colors.gold, fontWeight: Typography.weights.semiBold },
  rideCard: {
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.base, gap: Spacing.md, ...Shadows.card,
  },
  rideHeader: { alignItems: 'center', gap: Spacing.md },
  serviceIcon: {
    width: 44, height: 44, borderRadius: Radius.md,
    backgroundColor: Colors.goldFaint, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderGold,
  },
  cancelledIcon: { backgroundColor: Colors.surfaceElevated, borderColor: Colors.border },
  rideHeaderInfo: { flex: 1, gap: 3 },
  serviceLabel: { color: Colors.textPrimary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.semiBold },
  rideDate: { color: Colors.textSecondary, fontSize: Typography.sizes.sm },
  priceStatus: { alignItems: 'flex-end', gap: 4 },
  ridePrice: { color: Colors.gold, fontSize: Typography.sizes.base, fontWeight: Typography.weights.bold },
  statusBadge: { backgroundColor: Colors.goldFaint, borderRadius: Radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  cancelledBadge: { backgroundColor: Colors.surfaceElevated },
  statusText: { color: Colors.gold, fontSize: Typography.sizes.xs, fontWeight: Typography.weights.semiBold },
  cancelledText: { color: Colors.textMuted },
  routeSection: { flexDirection: 'row', gap: Spacing.md, alignItems: 'stretch' },
  routeDot: { alignItems: 'center', paddingTop: 4, gap: 2 },
  dotGreen: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  routeLine: { width: 1.5, flex: 1, backgroundColor: Colors.border, minHeight: 20 },
  dotGold: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.gold },
  routeLabels: { flex: 1, gap: Spacing.lg },
  routeFrom: { color: Colors.textPrimary, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.medium },
  routeTo: { color: Colors.textSecondary, fontSize: Typography.sizes.sm },
  captainRow: { alignItems: 'center', gap: Spacing.xs },
  captainName: { color: Colors.textMuted, fontSize: Typography.sizes.sm },
  empty: { alignItems: 'center', paddingTop: 80, gap: Spacing.base },
  emptyText: { color: Colors.textSecondary, fontSize: Typography.sizes.base },
});
