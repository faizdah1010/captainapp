import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Switch, Modal, TextInput, ActivityIndicator, Clipboard, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import {
  isBiometricHardwareAvailable,
  getBiometricType,
  BiometricType,
} from '@/services/biometricService';

export default function ProfileScreen() {
  const { user, logout, biometricEnabled, enableBiometric, disableBiometric, refreshProfile } = useAuth();
  const { t, language, isRTL, setLanguage } = useLanguage();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [biometricHwAvailable, setBiometricHwAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('none');

  // Edit Name modal state
  const [editNameVisible, setEditNameVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);

  // Referral copy feedback
  const [referralCopied, setReferralCopied] = useState(false);

  // Refreshing
  const [refreshing, setRefreshing] = useState(false);

  // Avatar upload
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    isBiometricHardwareAvailable().then((ok) => {
      setBiometricHwAvailable(ok);
      if (ok) getBiometricType().then(setBiometricType);
    });
  }, []);

  const handlePickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert(
        language === 'ar' ? 'إذن مرفوض' : 'Permission Denied',
        language === 'ar' ? 'يرجى السماح بالوصول إلى الصور من الإعدادات' : 'Please allow photo access in settings'
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    if (!asset.base64 || !user?.id) return;

    setUploadingAvatar(true);
    try {
      const supabase = getSupabaseClient();
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const filePath = `${user.id}/avatar.${ext}`;
      const contentType = `image/${ext === 'jpg' ? 'jpeg' : ext}`;

      // Convert base64 to Uint8Array for upload
      const byteCharacters = atob(asset.base64);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, byteArray, { contentType, upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from('user_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      await refreshProfile();
      showAlert(
        language === 'ar' ? 'تم التحديث' : 'Updated',
        language === 'ar' ? 'تم تحديث صورتك الشخصية بنجاح' : 'Profile picture updated successfully'
      );
    } catch {
      showAlert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'فشل رفع الصورة. حاول مجدداً.' : 'Failed to upload image. Try again.'
      );
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRefreshProfile = async () => {
    setRefreshing(true);
    await refreshProfile();
    setRefreshing(false);
  };

  const handleToggleBiometric = async (value: boolean) => {
    if (value) {
      await enableBiometric();
      showAlert(
        language === 'ar' ? 'تم التفعيل' : 'Enabled',
        language === 'ar'
          ? (biometricType === 'face' ? 'تم تفعيل الدخول بالوجه' : 'تم تفعيل الدخول بالبصمة')
          : (biometricType === 'face' ? 'Face ID enabled' : 'Fingerprint enabled')
      );
    } else {
      await disableBiometric();
    }
  };

  const handleLogout = () => {
    showAlert(
      language === 'ar' ? 'تسجيل الخروج' : 'Sign Out',
      language === 'ar' ? 'هل تريد تسجيل الخروج؟' : 'Are you sure you want to sign out?',
      [
        { text: t('cancel'), style: 'cancel' },
        {
          text: t('logout'), style: 'destructive', onPress: async () => {
            await logout();
            router.replace('/login');
          },
        },
      ]
    );
  };

  const handleOpenEditName = () => {
    setNewName(user?.username || '');
    setEditNameVisible(true);
  };

  const handleSaveName = async () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      showAlert(
        language === 'ar' ? 'اسم فارغ' : 'Empty Name',
        language === 'ar' ? 'الرجاء إدخال اسم صحيح' : 'Please enter a valid name'
      );
      return;
    }
    if (!user?.id) return;

    setSavingName(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('user_profiles')
        .update({ username: trimmed })
        .eq('id', user.id);

      if (error) throw error;

      await refreshProfile();
      setEditNameVisible(false);
      showAlert(
        language === 'ar' ? 'تم الحفظ' : 'Saved',
        language === 'ar' ? 'تم تحديث اسمك بنجاح' : 'Your name has been updated'
      );
    } catch {
      showAlert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'فشل حفظ الاسم. حاول مجدداً.' : 'Failed to save name. Try again.'
      );
    } finally {
      setSavingName(false);
    }
  };

  const handleCopyReferral = () => {
    if (!user?.referral_code) return;
    Clipboard.setString(user.referral_code);
    setReferralCopied(true);
    setTimeout(() => setReferralCopied(false), 2500);
  };

  // ─── Sub-components ───────────────────────────────────────────────────────

  const MenuSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { textAlign: isRTL ? 'right' : 'left' }]}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );

  const MenuItem = ({
    icon, label, value, onPress, showArrow = true, danger = false, rightNode,
  }: {
    icon: any; label: string; value?: string; onPress?: () => void;
    showArrow?: boolean; danger?: boolean; rightNode?: React.ReactNode;
  }) => (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
      onPress={onPress}
    >
      <View style={[styles.menuItemInner, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.menuIcon, danger && styles.dangerIcon]}>
          <MaterialIcons name={icon} size={20} color={danger ? Colors.error : Colors.gold} />
        </View>
        <Text style={[styles.menuLabel, danger && styles.dangerLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
          {label}
        </Text>
        <View style={styles.menuRight}>
          {value ? <Text style={styles.menuValue}>{value}</Text> : null}
          {rightNode}
          {showArrow && !rightNode ? (
            <MaterialIcons
              name={isRTL ? 'chevron-left' : 'chevron-right'}
              size={18}
              color={Colors.textMuted}
            />
          ) : null}
        </View>
      </View>
    </Pressable>
  );

  // ─── Derived display values ────────────────────────────────────────────────
  const displayName = user?.username || (language === 'ar' ? 'مستخدم طريقي' : 'Tariq User');
  const displayPhone = user?.phone || '—';
  const displayRating = user?.rating != null ? Number(user.rating).toFixed(1) : '4.8';
  const displayRides = user?.total_rides ?? 0;
  const displayReferral = user?.referral_code || '—';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>

        {/* ── Profile Header ─────────────────────────────────────────────── */}
        <View style={styles.profileHeader}>
          {/* Avatar */}
          <Pressable style={styles.avatarContainer} onPress={handlePickAvatar} disabled={uploadingAvatar}>
            {user?.avatar_url ? (
              <Image
                source={{ uri: user.avatar_url }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarInitial}>
                  {displayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.editAvatarBtn}>
              {uploadingAvatar
                ? <ActivityIndicator size="small" color={Colors.textOnGold} />
                : <MaterialIcons name="photo-camera" size={13} color={Colors.textOnGold} />}
            </View>
          </Pressable>

          {/* Name + edit inline */}
          <Pressable style={styles.nameRow} onPress={handleOpenEditName}>
            <Text style={styles.profileName}>{displayName}</Text>
            <MaterialIcons name="edit" size={16} color={Colors.textMuted} style={{ marginTop: 2 }} />
          </Pressable>

          {/* Phone — always LTR */}
          <Text style={styles.profilePhone}>{displayPhone}</Text>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{displayRides}</Text>
              <Text style={styles.statLabel}>{language === 'ar' ? 'رحلة' : 'Rides'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                <MaterialIcons name="star" size={16} color={Colors.gold} />
                <Text style={styles.statValue}>{displayRating}</Text>
              </View>
              <Text style={styles.statLabel}>{language === 'ar' ? 'تقييم' : 'Rating'}</Text>
            </View>
            <View style={styles.statDivider} />
            <Pressable style={styles.statItem} onPress={handleRefreshProfile}>
              {refreshing
                ? <ActivityIndicator size="small" color={Colors.gold} />
                : <MaterialIcons name="refresh" size={22} color={Colors.gold} />}
              <Text style={styles.statLabel}>{language === 'ar' ? 'تحديث' : 'Refresh'}</Text>
            </Pressable>
          </View>
        </View>

        {/* ── Referral Code Card ─────────────────────────────────────────── */}
        {user?.referral_code ? (
          <View style={styles.referralCard}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.referralTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
                {language === 'ar' ? 'كود الإحالة الخاص بك' : 'Your Referral Code'}
              </Text>
              <Text style={styles.referralCode}>{displayReferral}</Text>
              <Text style={[styles.referralSub, { textAlign: isRTL ? 'right' : 'left' }]}>
                {language === 'ar'
                  ? 'شارك الكود واحصل على 2 دينار لكل صديق'
                  : 'Share & earn 2 JOD per friend'}
              </Text>
            </View>
            <Pressable
              style={[styles.copyBtn, referralCopied && styles.copyBtnDone]}
              onPress={handleCopyReferral}
            >
              <MaterialIcons
                name={referralCopied ? 'check' : 'content-copy'}
                size={18}
                color={referralCopied ? Colors.success : Colors.textOnGold}
              />
              <Text style={[styles.copyBtnText, referralCopied && { color: Colors.success }]}>
                {referralCopied
                  ? (language === 'ar' ? 'تم النسخ' : 'Copied!')
                  : (language === 'ar' ? 'نسخ' : 'Copy')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Account Section ────────────────────────────────────────────── */}
        <MenuSection title={language === 'ar' ? 'الحساب' : 'Account'}>
          <MenuItem
            icon="edit"
            label={language === 'ar' ? 'تعديل الاسم' : 'Edit Name'}
            value={displayName}
            onPress={handleOpenEditName}
          />
          <MenuItem
            icon="phone"
            label={language === 'ar' ? 'رقم الهاتف' : 'Phone Number'}
            value={displayPhone}
            showArrow={false}
            onPress={() => {}}
          />
          <MenuItem
            icon="account-balance-wallet"
            label={language === 'ar' ? 'محفظتي' : 'My Wallet'}
            onPress={() => router.push('/wallet')}
            rightNode={
              <View style={styles.walletBadge}>
                <Text style={styles.walletBadgeText}>
                  {language === 'ar' ? 'د.أ' : 'JOD'}
                </Text>
              </View>
            }
            showArrow={false}
          />
          <MenuItem icon="place" label={t('savedPlaces')} onPress={() => {}} />
          <MenuItem icon="credit-card" label={t('paymentMethods')} onPress={() => {}} />
          <MenuItem
            icon="card-giftcard"
            label={language === 'ar' ? 'دعوة صديق' : 'Refer a Friend'}
            onPress={handleCopyReferral}
            showArrow={false}
            rightNode={
              <View style={styles.goldBadge}>
                <Text style={styles.goldBadgeText}>
                  {referralCopied
                    ? (language === 'ar' ? 'تم النسخ ✓' : 'Copied ✓')
                    : (language === 'ar' ? 'احصل على 2 د.أ' : 'Earn 2 JOD')}
                </Text>
              </View>
            }
          />
        </MenuSection>

        {/* ── Language Section ───────────────────────────────────────────── */}
        <MenuSection title={t('language')}>
          <MenuItem
            icon="language"
            label={language === 'ar' ? 'اللغة الحالية' : 'Current Language'}
            value={language === 'ar' ? 'العربية' : 'English'}
            onPress={() => {}}
            showArrow={false}
            rightNode={
              <Pressable
                style={styles.langToggle}
                onPress={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              >
                <Text style={styles.langToggleText}>{language === 'ar' ? 'English' : 'عربي'}</Text>
              </Pressable>
            }
          />
        </MenuSection>

        {/* ── Settings ──────────────────────────────────────────────────── */}
        <MenuSection title={language === 'ar' ? 'الإعدادات' : 'Settings'}>
          <MenuItem icon="notifications-none" label={t('notifications')} onPress={() => {}} />
          {biometricHwAvailable ? (
            <MenuItem
              icon={biometricType === 'face' ? 'face' : 'fingerprint'}
              label={
                biometricType === 'face'
                  ? (language === 'ar' ? 'الدخول بالوجه (Face ID)' : 'Face ID Login')
                  : (language === 'ar' ? 'الدخول بالبصمة' : 'Fingerprint Login')
              }
              showArrow={false}
              onPress={() => {}}
              rightNode={
                <Switch
                  value={biometricEnabled}
                  onValueChange={handleToggleBiometric}
                  trackColor={{ false: Colors.border, true: Colors.primaryLight }}
                  thumbColor={biometricEnabled ? Colors.gold : Colors.textMuted}
                />
              }
            />
          ) : null}
          <MenuItem icon="lock-outline" label={t('privacy')} onPress={() => {}} />
          <MenuItem icon="headset-mic" label={t('support')} onPress={() => {}} />
          <MenuItem
            icon="info-outline"
            label={t('version')}
            value="1.0.0"
            showArrow={false}
            onPress={() => {}}
          />
        </MenuSection>

        {/* ── Admin Panel ───────────────────────────────────────────────── */}
        <MenuSection title={language === 'ar' ? 'المشرف' : 'Admin'}>
          <MenuItem
            icon="admin-panel-settings"
            label={language === 'ar' ? 'لوحة إدارة الكباتن' : 'Captain Admin Panel'}
            onPress={() => router.push('/admin')}
          />
        </MenuSection>

        {/* ── Logout ────────────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionCard}>
            <MenuItem icon="logout" label={t('logout')} danger onPress={handleLogout} />
          </View>
        </View>
      </ScrollView>

      {/* ── Edit Name Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={editNameVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditNameVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setEditNameVisible(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={[styles.modalTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
              {language === 'ar' ? 'تعديل الاسم' : 'Edit Name'}
            </Text>
            <Text style={[styles.modalSub, { textAlign: isRTL ? 'right' : 'left' }]}>
              {language === 'ar' ? 'سيظهر هذا الاسم في رحلاتك وتقييماتك' : 'This name appears on your rides and ratings'}
            </Text>

            <TextInput
              style={[
                styles.nameInput,
                { textAlign: isRTL ? 'right' : 'left' },
              ]}
              value={newName}
              onChangeText={setNewName}
              placeholder={language === 'ar' ? 'اسمك الكامل' : 'Your full name'}
              placeholderTextColor={Colors.textMuted}
              maxLength={60}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSaveName}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setEditNameVisible(false)}
              >
                <Text style={styles.modalCancelText}>{t('cancel')}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalSaveBtn, savingName && { opacity: 0.6 }]}
                onPress={handleSaveName}
                disabled={savingName}
              >
                {savingName
                  ? <ActivityIndicator size="small" color={Colors.textOnGold} />
                  : <Text style={styles.modalSaveText}>{t('save')}</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ── Header ──
  profileHeader: {
    alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border, marginBottom: Spacing.base,
    paddingHorizontal: Spacing.base,
  },
  avatarContainer: { position: 'relative', marginBottom: Spacing.sm },
  avatar: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: Colors.goldFaint, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5, borderColor: Colors.gold, ...Shadows.gold,
  },
  avatarImage: {
    width: 90, height: 90, borderRadius: 45,
    borderWidth: 2.5, borderColor: Colors.gold,
  },
  avatarInitial: {
    color: Colors.gold, fontSize: 36, fontWeight: Typography.weights.bold,
  },
  editAvatarBtn: {
    position: 'absolute', bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.background,
  },
  nameRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
  },
  profileName: {
    color: Colors.textPrimary, fontSize: Typography.sizes.xl, fontWeight: Typography.weights.bold,
  },
  profilePhone: {
    color: Colors.textSecondary, fontSize: Typography.sizes.base,
    // @ts-ignore
    direction: 'ltr',
  },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.surfaceCard, borderRadius: Radius.lg, padding: Spacing.base,
    borderWidth: 1, borderColor: Colors.borderGold, marginTop: Spacing.sm,
    alignSelf: 'stretch', justifyContent: 'space-around',
  },
  statItem: { alignItems: 'center', gap: 4, minWidth: 60 },
  statValue: { color: Colors.gold, fontSize: Typography.sizes.xl, fontWeight: Typography.weights.bold },
  statLabel: { color: Colors.textSecondary, fontSize: Typography.sizes.sm },
  statDivider: { width: 1, height: 36, backgroundColor: Colors.border },

  // ── Referral Card ──
  referralCard: {
    marginHorizontal: Spacing.base,
    marginBottom: Spacing.base,
    backgroundColor: Colors.surfaceCard,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.borderGold,
    padding: Spacing.base,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.gold,
  },
  referralTitle: {
    color: Colors.textSecondary, fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium, marginBottom: 4,
  },
  referralCode: {
    color: Colors.gold, fontSize: Typography.sizes.xxl,
    fontWeight: Typography.weights.bold, letterSpacing: 3,
    // @ts-ignore
    direction: 'ltr',
  },
  referralSub: {
    color: Colors.textMuted, fontSize: Typography.sizes.xs, marginTop: 4,
  },
  copyBtn: {
    backgroundColor: Colors.gold, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    alignItems: 'center', gap: 4, minWidth: 64,
  },
  copyBtnDone: { backgroundColor: Colors.goldFaint, borderWidth: 1, borderColor: Colors.success },
  copyBtnText: { color: Colors.textOnGold, fontSize: Typography.sizes.xs, fontWeight: Typography.weights.bold },

  // ── Sections ──
  section: { paddingHorizontal: Spacing.base, marginBottom: Spacing.base },
  sectionTitle: {
    color: Colors.textSecondary, fontSize: Typography.sizes.sm,
    fontWeight: Typography.weights.medium, marginBottom: Spacing.sm,
  },
  sectionCard: {
    backgroundColor: Colors.surfaceCard, borderRadius: Radius.lg,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden',
  },
  menuItem: { minHeight: 54 },
  menuItemPressed: { backgroundColor: Colors.goldFaint },
  menuItemInner: {
    flex: 1, alignItems: 'center', gap: Spacing.md,
    paddingHorizontal: Spacing.base, minHeight: 54,
  },
  menuIcon: {
    width: 36, height: 36, borderRadius: Radius.sm,
    backgroundColor: Colors.goldFaint, alignItems: 'center', justifyContent: 'center',
  },
  dangerIcon: { backgroundColor: 'rgba(224,80,80,0.1)' },
  menuLabel: { flex: 1, color: Colors.textPrimary, fontSize: Typography.sizes.base },
  dangerLabel: { color: Colors.error },
  menuRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  menuValue: { color: Colors.textSecondary, fontSize: Typography.sizes.sm, maxWidth: 120 },
  goldBadge: {
    backgroundColor: Colors.goldFaint, borderRadius: Radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: Colors.borderGold,
  },
  goldBadgeText: { color: Colors.gold, fontSize: Typography.sizes.xs, fontWeight: Typography.weights.bold },
  langToggle: {
    backgroundColor: Colors.gold, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  langToggleText: { color: Colors.textOnGold, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.bold },
  walletBadge: {
    backgroundColor: Colors.gold, borderRadius: Radius.full,
    paddingHorizontal: Spacing.sm, paddingVertical: 3, minWidth: 36, alignItems: 'center',
  },
  walletBadgeText: { color: Colors.textOnGold, fontSize: Typography.sizes.xs, fontWeight: Typography.weights.bold },

  // ── Edit Name Modal ──
  modalOverlay: {
    flex: 1, backgroundColor: Colors.overlay,
    justifyContent: 'center', alignItems: 'center', padding: Spacing.xl,
  },
  modalCard: {
    width: '100%', backgroundColor: Colors.surface,
    borderRadius: Radius.xl, padding: Spacing.xl,
    borderWidth: 1, borderColor: Colors.border,
    ...Shadows.deep,
  },
  modalTitle: {
    color: Colors.textPrimary, fontSize: Typography.sizes.xl,
    fontWeight: Typography.weights.bold, marginBottom: Spacing.xs,
  },
  modalSub: {
    color: Colors.textSecondary, fontSize: Typography.sizes.sm,
    marginBottom: Spacing.lg,
  },
  nameInput: {
    backgroundColor: Colors.surfaceCard,
    borderWidth: 1, borderColor: Colors.borderGold,
    borderRadius: Radius.md, paddingHorizontal: Spacing.base,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    color: Colors.textPrimary, fontSize: Typography.sizes.base,
    marginBottom: Spacing.lg,
  },
  modalActions: { flexDirection: 'row', gap: Spacing.md },
  modalCancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  modalCancelText: { color: Colors.textSecondary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.medium },
  modalSaveBtn: {
    flex: 1, paddingVertical: 14, borderRadius: Radius.md,
    backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center',
  },
  modalSaveText: { color: Colors.textOnGold, fontSize: Typography.sizes.base, fontWeight: Typography.weights.bold },
});
