/**
 * Admin Panel — إدارة الكباتن
 * Protected by a hardcoded PIN (change in production)
 * Route: /admin  (add to _layout.tsx Stack)
 */
import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  TextInput, ActivityIndicator, Switch, RefreshControl,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { getSupabaseClient } from '@/template';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';

const ADMIN_PIN = '1234'; // Change before production

interface Captain {
  id: string;
  phone: string;
  name_ar: string;
  name_en: string;
  vehicle_model: string | null;
  plate_number: string | null;
  rating: number;
  total_trips: number;
  is_online: boolean;
  is_approved: boolean;
  service_types: string[];
  created_at: string;
}

const SERVICE_LABEL: Record<string, string> = {
  regular: 'عادي', ladies: 'نسائي', express: 'إكسبرس',
};

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  // ── Auth state ─────────────────────────────────────────────────────────────
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  // ── Data state ─────────────────────────────────────────────────────────────
  const [captains, setCaptains] = useState<Captain[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [search, setSearch] = useState('');

  // ── Fetch captains ─────────────────────────────────────────────────────────
  const fetchCaptains = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      // Admin uses service role logic — fetch all by selecting all with no filter
      const { data, error } = await supabase
        .from('captain_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setCaptains(data as Captain[]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleUnlock = () => {
    if (pinInput === ADMIN_PIN) {
      setUnlocked(true);
      fetchCaptains();
    } else {
      setPinError('رمز غير صحيح');
      setPinInput('');
    }
  };

  const handleToggleApproval = async (captain: Captain) => {
    setTogglingId(captain.id);
    const newVal = !captain.is_approved;
    const { error } = await supabase
      .from('captain_profiles')
      .update({ is_approved: newVal })
      .eq('id', captain.id);

    if (!error) {
      setCaptains((prev) =>
        prev.map((c) => (c.id === captain.id ? { ...c, is_approved: newVal } : c))
      );
    }
    setTogglingId(null);
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCaptains(false);
  };

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filtered = captains.filter((c) => {
    const matchFilter =
      filter === 'all' ? true :
      filter === 'pending' ? !c.is_approved :
      c.is_approved;
    const matchSearch =
      !search.trim() ||
      c.name_ar.includes(search) ||
      c.name_en.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search);
    return matchFilter && matchSearch;
  });

  const pending = captains.filter((c) => !c.is_approved).length;
  const approved = captains.filter((c) => c.is_approved).length;

  // ── PIN screen ─────────────────────────────────────────────────────────────
  if (!unlocked) {
    return (
      <KeyboardAvoidingView
        style={[styles.root, { paddingTop: insets.top }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={22} color={Colors.gold} />
        </Pressable>

        <View style={styles.pinContainer}>
          <View style={styles.pinIconBox}>
            <MaterialIcons name="admin-panel-settings" size={52} color={Colors.red} />
          </View>
          <Text style={styles.pinTitle}>لوحة الإدارة</Text>
          <Text style={styles.pinSub}>أدخل رمز الدخول للمشرف</Text>

          <View style={styles.pinInputWrapper}>
            <TextInput
              style={styles.pinInput}
              value={pinInput}
              onChangeText={(v) => { setPinInput(v); setPinError(''); }}
              placeholder="• • • •"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              secureTextEntry
              textAlign="center"
              maxLength={6}
              autoFocus
            />
          </View>

          {pinError ? (
            <Text style={styles.pinError}>{pinError}</Text>
          ) : null}

          <Pressable style={styles.pinBtn} onPress={handleUnlock}>
            <Text style={styles.pinBtnText}>دخول</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── Admin panel ────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.iconBtn} onPress={() => router.back()}>
          <MaterialIcons name="arrow-back" size={20} color={Colors.gold} />
        </Pressable>
        <Text style={styles.headerTitle}>إدارة الكباتن</Text>
        <Pressable style={styles.iconBtn} onPress={() => fetchCaptains()}>
          <MaterialIcons name="refresh" size={20} color={Colors.textMuted} />
        </Pressable>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{captains.length}</Text>
          <Text style={styles.statLabel}>إجمالي</Text>
        </View>
        <View style={[styles.statCard, { borderColor: Colors.green + '60' }]}>
          <Text style={[styles.statValue, { color: Colors.green }]}>{approved}</Text>
          <Text style={styles.statLabel}>معتمد</Text>
        </View>
        <View style={[styles.statCard, { borderColor: Colors.warning + '60' }]}>
          <Text style={[styles.statValue, { color: Colors.warning }]}>{pending}</Text>
          <Text style={styles.statLabel}>قيد المراجعة</Text>
        </View>
        <View style={[styles.statCard, { borderColor: Colors.borderGold }]}>
          <Text style={[styles.statValue, { color: Colors.gold }]}>
            {captains.filter((c) => c.is_online).length}
          </Text>
          <Text style={styles.statLabel}>متصل الآن</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchBar}>
        <MaterialIcons name="search" size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="بحث بالاسم أو الهاتف..."
          placeholderTextColor={Colors.textMuted}
          textAlign="right"
        />
        {search ? (
          <Pressable onPress={() => setSearch('')}>
            <MaterialIcons name="close" size={16} color={Colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {(['all', 'pending', 'approved'] as const).map((f) => (
          <Pressable
            key={f}
            style={[styles.chip, filter === f && styles.chipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
              {f === 'all' ? 'الكل' : f === 'pending' ? 'قيد المراجعة' : 'معتمد'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.red} size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.red} />
          }
          renderItem={({ item }) => (
            <View style={styles.captainCard}>
              {/* Row 1: name + online badge */}
              <View style={styles.row}>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.captainName}>{item.name_ar}</Text>
                  <Text style={styles.captainSub}>{item.name_en}</Text>
                </View>
                {item.is_online ? (
                  <View style={styles.onlineBadge}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>متصل</Text>
                  </View>
                ) : null}
              </View>

              {/* Phone */}
              <View style={styles.infoRow}>
                <MaterialIcons name="phone" size={14} color={Colors.textMuted} />
                <Text style={styles.infoText}>{item.phone}</Text>
              </View>

              {/* Vehicle */}
              {item.vehicle_model ? (
                <View style={styles.infoRow}>
                  <MaterialIcons name="directions-car" size={14} color={Colors.textMuted} />
                  <Text style={styles.infoText}>
                    {item.vehicle_model}{item.plate_number ? ` · ${item.plate_number}` : ''}
                  </Text>
                </View>
              ) : null}

              {/* Services */}
              <View style={styles.serviceRow}>
                {(item.service_types ?? []).map((s) => (
                  <View key={s} style={styles.serviceTag}>
                    <Text style={styles.serviceTagText}>{SERVICE_LABEL[s] ?? s}</Text>
                  </View>
                ))}
              </View>

              {/* Stats row */}
              <View style={styles.statsInCard}>
                <View style={styles.miniStat}>
                  <MaterialIcons name="star" size={12} color={Colors.gold} />
                  <Text style={styles.miniStatText}>{Number(item.rating).toFixed(1)}</Text>
                </View>
                <View style={styles.miniStat}>
                  <MaterialIcons name="directions-car" size={12} color={Colors.textMuted} />
                  <Text style={styles.miniStatText}>{item.total_trips} رحلة</Text>
                </View>
                <Text style={styles.dateText}>
                  {new Date(item.created_at).toLocaleDateString('ar-JO', { year: 'numeric', month: 'short', day: 'numeric' })}
                </Text>
              </View>

              {/* Approval toggle */}
              <View style={[styles.row, styles.approvalRow]}>
                <View style={[styles.approvalBadge, { backgroundColor: item.is_approved ? Colors.green + '20' : Colors.warning + '20' }]}>
                  <View style={[styles.approvalDot, { backgroundColor: item.is_approved ? Colors.green : Colors.warning }]} />
                  <Text style={[styles.approvalText, { color: item.is_approved ? Colors.green : Colors.warning }]}>
                    {item.is_approved ? 'معتمد' : 'قيد المراجعة'}
                  </Text>
                </View>
                {togglingId === item.id ? (
                  <ActivityIndicator size="small" color={Colors.red} />
                ) : (
                  <Switch
                    value={item.is_approved}
                    onValueChange={() => handleToggleApproval(item)}
                    trackColor={{ false: Colors.border, true: Colors.green + '80' }}
                    thumbColor={item.is_approved ? Colors.green : Colors.textMuted}
                  />
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={() => (
            <View style={styles.center}>
              <MaterialIcons name="person-search" size={52} color={Colors.redDim} />
              <Text style={styles.emptyTitle}>
                {search ? 'لا توجد نتائج' : 'لا يوجد كباتن'}
              </Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xxl },

  backBtn: {
    position: 'absolute', top: 16, left: 16, zIndex: 10,
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surfaceCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },

  // PIN
  pinContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xxl, gap: Spacing.lg },
  pinIconBox: {
    width: 100, height: 100, borderRadius: 28,
    backgroundColor: Colors.redFaint, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.red, ...Shadows.red,
  },
  pinTitle: { color: Colors.textPrimary, fontSize: Typography.sizes.xxl, fontWeight: Typography.weights.bold },
  pinSub: { color: Colors.textMuted, fontSize: Typography.sizes.sm },
  pinInputWrapper: {
    width: '100%', backgroundColor: Colors.surfaceCard, borderRadius: Radius.xl,
    borderWidth: 1.5, borderColor: Colors.borderGold, overflow: 'hidden',
  },
  pinInput: {
    color: Colors.textPrimary, fontSize: Typography.sizes.xxl,
    letterSpacing: 12, paddingVertical: Spacing.base, fontWeight: Typography.weights.bold,
  },
  pinError: { color: Colors.error, fontSize: Typography.sizes.sm },
  pinBtn: {
    width: '100%', backgroundColor: Colors.red, borderRadius: Radius.md,
    paddingVertical: 16, alignItems: 'center', ...Shadows.red,
  },
  pinBtnText: { color: '#fff', fontSize: Typography.sizes.base, fontWeight: Typography.weights.bold },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  headerTitle: { color: Colors.textPrimary, fontSize: Typography.sizes.xl, fontWeight: Typography.weights.bold },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surfaceCard,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },

  // Stats
  statsRow: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.base },
  statCard: {
    flex: 1, backgroundColor: Colors.surfaceCard, borderRadius: Radius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 2,
    borderWidth: 1, borderColor: Colors.border,
  },
  statValue: { color: Colors.textPrimary, fontSize: Typography.sizes.xl, fontWeight: Typography.weights.extraBold },
  statLabel: { color: Colors.textMuted, fontSize: 10, textAlign: 'center' },

  // Search
  searchBar: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    marginHorizontal: Spacing.base, marginBottom: Spacing.sm,
    backgroundColor: Colors.surfaceCard, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md,
    minHeight: 48,
  },
  searchInput: { flex: 1, color: Colors.textPrimary, fontSize: Typography.sizes.base },

  // Filter chips
  filterRow: { flexDirection: 'row-reverse', gap: Spacing.sm, paddingHorizontal: Spacing.base, marginBottom: Spacing.sm },
  chip: {
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surfaceCard,
  },
  chipActive: { borderColor: Colors.red, backgroundColor: Colors.redFaint },
  chipText: { color: Colors.textMuted, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.medium },
  chipTextActive: { color: Colors.red, fontWeight: Typography.weights.bold },

  // List
  list: { padding: Spacing.base, gap: Spacing.md, paddingBottom: 100 },
  captainCard: {
    backgroundColor: Colors.surfaceCard, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, padding: Spacing.base, gap: Spacing.md,
    ...Shadows.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  captainName: { color: Colors.textPrimary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.bold },
  captainSub: { color: Colors.textSecondary, fontSize: Typography.sizes.xs },
  onlineBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: Colors.green + '20', borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.green },
  onlineText: { color: Colors.green, fontSize: Typography.sizes.xs, fontWeight: Typography.weights.semiBold },
  infoRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm },
  infoText: { color: Colors.textSecondary, fontSize: Typography.sizes.sm },
  serviceRow: { flexDirection: 'row-reverse', gap: Spacing.sm },
  serviceTag: {
    backgroundColor: Colors.goldFaint, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: Colors.borderGold,
  },
  serviceTagText: { color: Colors.gold, fontSize: Typography.sizes.xs, fontWeight: Typography.weights.semiBold },
  statsInCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.base },
  miniStat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniStatText: { color: Colors.textMuted, fontSize: Typography.sizes.xs },
  dateText: { flex: 1, color: Colors.textMuted, fontSize: 10, textAlign: 'left' },
  approvalRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.md },
  approvalBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 6,
  },
  approvalDot: { width: 8, height: 8, borderRadius: 4 },
  approvalText: { fontSize: Typography.sizes.sm, fontWeight: Typography.weights.semiBold },
  emptyTitle: { color: Colors.textPrimary, fontSize: Typography.sizes.lg, fontWeight: Typography.weights.bold, textAlign: 'center' },
});
