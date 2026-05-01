import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useLanguage } from '@/hooks/useLanguage';
import { useRide } from '@/hooks/useRide';
import { useAlert } from '@/template';
import { GoldButton } from '@/components/ui/GoldButton';
import { GoldInput } from '@/components/ui/GoldInput';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { CONFIG } from '@/constants/config';
import { ServiceType } from '@/contexts/RideContext';

const SERVICES: { type: ServiceType; icon: any; labelAr: string; labelEn: string }[] = [
  { type: 'regular', icon: 'directions-car', labelAr: 'طريق', labelEn: 'Tariq' },
  { type: 'ladies', icon: 'face', labelAr: 'طريق نسائي', labelEn: 'Ladies' },
  { type: 'express', icon: 'local-shipping', labelAr: 'إكسبرس', labelEn: 'Express' },
];

export default function BookingScreen() {
  const { t, language, isRTL } = useLanguage();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    selectedService, setSelectedService,
    pickup, setPickup, dropoff, setDropoff,
    estimatedPrice, discountCode, setDiscountCode,
    discountPercent, applyDiscount, finalPrice,
    startRide,
  } = useRide();
  const lang = language as 'ar' | 'en';

  const [codeInput, setCodeInput] = useState(discountCode);
  const [codeApplied, setCodeApplied] = useState(discountPercent > 0);
  const [loading, setLoading] = useState(false);

  const govs = CONFIG.GOVERNORATES;

  const handleApplyCode = () => {
    const success = applyDiscount(codeInput);
    if (success) {
      setCodeApplied(true);
      setDiscountCode(codeInput);
      showAlert(
        language === 'ar' ? 'تم تطبيق الكود!' : 'Code Applied!',
        language === 'ar' ? `خصم ${applyDiscount(codeInput) ? discountPercent : 0}% تم تطبيقه` : 'Discount applied successfully'
      );
    } else {
      showAlert(
        language === 'ar' ? 'كود غير صحيح' : 'Invalid Code',
        language === 'ar' ? 'يرجى التحقق من الكود وإعادة المحاولة' : 'Please check the code and try again'
      );
    }
  };

  const handleBook = async () => {
    if (!pickup || !dropoff) {
      showAlert(
        language === 'ar' ? 'تنبيه' : 'Alert',
        language === 'ar' ? 'يرجى تحديد نقطة الانطلاق والوجهة' : 'Please select pickup and destination'
      );
      return;
    }
    setLoading(true);
    startRide(lang);
    setTimeout(() => {
      setLoading(false);
      router.replace('/tracking');
    }, 1000);
  };

  const selectedPickup = pickup || govs[0];
  const selectedDropoff = dropoff || govs[1];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <MaterialIcons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={Colors.gold} />
          </Pressable>
          <Text style={styles.headerTitle}>{t('confirmRide')}</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          {/* Route Card */}
          <View style={styles.routeCard}>
            {/* Pickup */}
            <Pressable style={styles.locationRow}>
              <View style={styles.dotGreen} />
              <View style={[styles.locationText, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                <Text style={styles.locationLabel}>{t('selectPickup')}</Text>
                <Text style={styles.locationValue}>
                  {language === 'ar' ? (pickup?.name || govs[0].nameAr) : (pickup?.nameEn || govs[0].nameEn)}
                </Text>
              </View>
              <MaterialIcons name={isRTL ? 'chevron-left' : 'chevron-right'} size={18} color={Colors.textMuted} />
            </Pressable>

            <View style={styles.routeDivider}>
              <View style={styles.routeLine} />
            </View>

            {/* Dropoff */}
            <Pressable style={styles.locationRow}>
              <View style={styles.dotGold} />
              <View style={[styles.locationText, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
                <Text style={styles.locationLabel}>{t('selectDropoff')}</Text>
                <Text style={styles.locationValue}>
                  {language === 'ar' ? (dropoff?.name || govs[1].nameAr) : (dropoff?.nameEn || govs[1].nameEn)}
                </Text>
              </View>
              <MaterialIcons name={isRTL ? 'chevron-left' : 'chevron-right'} size={18} color={Colors.textMuted} />
            </Pressable>
          </View>

          {/* Quick Destination Selector */}
          <Text style={[styles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
            {language === 'ar' ? 'اختر الوجهة' : 'Select Destination'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.govsScroll}>
            <View style={[styles.govsRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {govs.map((gov) => {
                const isSelected = dropoff?.name === gov.nameAr;
                return (
                  <Pressable
                    key={gov.id}
                    style={[styles.govChip, isSelected && styles.govChipSelected]}
                    onPress={() => setDropoff({ name: gov.nameAr, nameEn: gov.nameEn, lat: gov.lat, lng: gov.lng })}
                  >
                    <Text style={[styles.govChipText, isSelected && styles.govChipTextSelected]}>
                      {language === 'ar' ? gov.nameAr : gov.nameEn}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {/* Service Selection */}
          <Text style={[styles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
            {t('ourServices')}
          </Text>
          <View style={[styles.servicesRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {SERVICES.map((svc) => (
              <Pressable
                key={svc.type}
                style={[styles.serviceChip, selectedService === svc.type && styles.serviceChipSelected]}
                onPress={() => setSelectedService(svc.type)}
              >
                <MaterialIcons
                  name={svc.icon}
                  size={18}
                  color={selectedService === svc.type ? Colors.textOnGold : Colors.gold}
                />
                <Text style={[styles.serviceChipText, selectedService === svc.type && styles.serviceChipTextSelected]}>
                  {language === 'ar' ? svc.labelAr : svc.labelEn}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Discount Code */}
          <Text style={[styles.sectionLabel, { textAlign: isRTL ? 'right' : 'left' }]}>
            {t('discountCode')}
          </Text>
          <View style={[styles.discountRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <GoldInput
              value={codeInput}
              onChangeText={setCodeInput}
              placeholder={t('enterDiscountCode')}
              textAlign={isRTL ? 'right' : 'left'}
              style={styles.discountInput}
              editable={!codeApplied}
            />
            {codeApplied ? (
              <Pressable style={styles.clearCodeBtn} onPress={() => { setCodeInput(''); setCodeApplied(false); applyDiscount(''); }}>
                <MaterialIcons name="close" size={18} color={Colors.error} />
              </Pressable>
            ) : (
              <Pressable style={styles.applyBtn} onPress={handleApplyCode}>
                <Text style={styles.applyBtnText}>{t('applyCode')}</Text>
              </Pressable>
            )}
          </View>
          {codeApplied ? (
            <View style={[styles.discountApplied, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <MaterialIcons name="check-circle" size={16} color={Colors.success} />
              <Text style={styles.discountAppliedText}>
                {language === 'ar' ? `خصم ${discountPercent}% مُطبَّق!` : `${discountPercent}% discount applied!`}
              </Text>
            </View>
          ) : null}

          {/* Price Summary */}
          <View style={styles.priceCard}>
            <View style={[styles.priceRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={styles.priceLabel}>{t('estimatedPrice')}</Text>
              <Text style={styles.priceBase}>{estimatedPrice.toFixed(2)} {language === 'ar' ? 'د.أ' : 'JOD'}</Text>
            </View>
            {discountPercent > 0 ? (
              <View style={[styles.priceRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Text style={[styles.priceLabel, { color: Colors.success }]}>{t('discount')}</Text>
                <Text style={[styles.priceBase, { color: Colors.success }]}>
                  -{discountPercent}%
                </Text>
              </View>
            ) : null}
            <View style={styles.priceDivider} />
            <View style={[styles.priceRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={styles.totalLabel}>{language === 'ar' ? 'الإجمالي' : 'Total'}</Text>
              <Text style={styles.totalValue}>{finalPrice.toFixed(2)} {language === 'ar' ? 'د.أ' : 'JOD'}</Text>
            </View>
          </View>

          <GoldButton
            label={t('bookNow')}
            onPress={handleBook}
            loading={loading}
            size="lg"
            style={styles.bookBtn}
          />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surfaceCard,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  headerTitle: { color: Colors.textPrimary, fontSize: Typography.sizes.lg, fontWeight: Typography.weights.bold },
  scroll: { padding: Spacing.base, gap: Spacing.base, paddingBottom: 80 },
  routeCard: {
    backgroundColor: Colors.surfaceCard, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', ...Shadows.card,
  },
  locationRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    padding: Spacing.base, minHeight: 64,
  },
  dotGreen: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.success, flexShrink: 0 },
  dotGold: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.gold, flexShrink: 0 },
  locationText: { flex: 1, gap: 2 },
  locationLabel: { color: Colors.textMuted, fontSize: Typography.sizes.xs },
  locationValue: { color: Colors.textPrimary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.semiBold },
  routeDivider: { paddingLeft: Spacing.base + 5, paddingVertical: 0 },
  routeLine: { height: 24, width: 1.5, backgroundColor: Colors.border, marginLeft: 5 },
  sectionLabel: { color: Colors.textSecondary, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.medium },
  govsScroll: { marginHorizontal: -Spacing.base },
  govsRow: { gap: Spacing.sm, paddingHorizontal: Spacing.base },
  govChip: {
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surfaceCard, minHeight: 40, justifyContent: 'center',
  },
  govChipSelected: { borderColor: Colors.gold, backgroundColor: Colors.goldFaint },
  govChipText: { color: Colors.textSecondary, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.medium },
  govChipTextSelected: { color: Colors.gold, fontWeight: Typography.weights.bold },
  servicesRow: { gap: Spacing.sm },
  serviceChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceCard,
    minHeight: 48,
  },
  serviceChipSelected: { backgroundColor: Colors.gold, borderColor: Colors.goldLight },
  serviceChipText: { color: Colors.gold, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.semiBold },
  serviceChipTextSelected: { color: Colors.textOnGold },
  discountRow: { alignItems: 'center', gap: Spacing.sm },
  discountInput: { flex: 1 },
  applyBtn: {
    backgroundColor: Colors.goldFaint, borderRadius: Radius.md, paddingHorizontal: Spacing.base,
    height: 54, justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderGold,
  },
  applyBtnText: { color: Colors.gold, fontWeight: Typography.weights.bold, fontSize: Typography.sizes.base },
  clearCodeBtn: {
    width: 54, height: 54, borderRadius: Radius.md, backgroundColor: 'rgba(224,80,80,0.1)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(224,80,80,0.2)',
  },
  discountApplied: { alignItems: 'center', gap: Spacing.sm },
  discountAppliedText: { color: Colors.success, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.medium },
  priceCard: {
    backgroundColor: Colors.surfaceCard, borderRadius: Radius.xl, padding: Spacing.base,
    borderWidth: 1, borderColor: Colors.borderGold, gap: Spacing.sm, ...Shadows.gold,
  },
  priceRow: { justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { color: Colors.textSecondary, fontSize: Typography.sizes.base },
  priceBase: { color: Colors.textPrimary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.medium },
  priceDivider: { height: 1, backgroundColor: Colors.border },
  totalLabel: { color: Colors.textPrimary, fontSize: Typography.sizes.lg, fontWeight: Typography.weights.bold },
  totalValue: { color: Colors.gold, fontSize: Typography.sizes.xxl, fontWeight: Typography.weights.extraBold },
  bookBtn: { marginTop: Spacing.sm },
});
