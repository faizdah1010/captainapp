import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Modal, TextInput, Animated, Share, Platform, Linking, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useLanguage } from '@/hooks/useLanguage';
import { useWallet } from '@/hooks/useWallet';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { Transaction } from '@/contexts/WalletContext';

const TOP_UP_AMOUNTS = [5, 10, 20, 50];

const TX_COLORS = {
  topup: Colors.success,
  credit: Colors.gold,
  refund: Colors.info,
  debit: Colors.error,
};

export default function WalletScreen() {
  const { t, language, isRTL } = useLanguage();
  const { balanceJOD, referralCode, transactions, addBalance, refreshWallet } = useWallet();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [showTopUp, setShowTopUp] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);
  const [codeCopied, setCodeCopied] = useState(false);
  const [filter, setFilter] = useState<'all' | 'topup' | 'debit' | 'credit' | 'refund'>('all');
  const [stripeLoading, setStripeLoading] = useState(false);

  const scaleAnim = useRef(new Animated.Value(1)).current;

  // ── Handle deep link return from Stripe ────────────────────────────────────
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const { url } = event;
      if (url.includes('payment/success')) {
        // Extract amount from URL
        const match = url.match(/amount=([0-9.]+)/);
        const amount = match ? parseFloat(match[1]) : null;

        if (amount && amount > 0) {
          await addBalance(amount);
          pulseBal();
          showAlert(
            language === 'ar' ? 'تم الشحن بنجاح! ✓' : 'Top-up Successful! ✓',
            language === 'ar'
              ? `تمت إضافة ${amount.toFixed(3)} د.أ إلى محفظتك`
              : `${amount.toFixed(3)} JOD added to your wallet`
          );
        } else {
          await refreshWallet();
        }
        setShowTopUp(false);
      } else if (url.includes('payment/cancel')) {
        showAlert(
          language === 'ar' ? 'تم الإلغاء' : 'Cancelled',
          language === 'ar' ? 'لم يتم إتمام الدفع' : 'Payment was not completed'
        );
      }
    };

    // Check initial URL (app opened via deep link)
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    const sub = Linking.addEventListener('url', handleDeepLink);
    return () => sub.remove();
  }, [language]);

  const pulseBal = () => {
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 1.06, duration: 120, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const handleCopyCode = () => {
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2500);
    showAlert(
      language === 'ar' ? 'تم النسخ!' : 'Copied!',
      language === 'ar' ? `كود الإحالة: ${referralCode}` : `Referral code: ${referralCode}`
    );
  };

  const handleShare = async () => {
    const msg = language === 'ar'
      ? `انضم إلى طريق واستخدم كودي الشخصي ${referralCode} واحصل على خصم على أول رحلة! 🚗✨`
      : `Join Tariq and use my referral code ${referralCode} to get a discount on your first ride! 🚗✨`;
    try { await Share.share({ message: msg }); } catch { /* ignore */ }
  };

  // ── Stripe Top-Up ─────────────────────────────────────────────────────────
  const handleStripeTopUp = async () => {
    const amount = selectedAmount ?? parseFloat(customAmount);
    if (!amount || isNaN(amount) || amount <= 0) {
      showAlert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'يرجى اختيار أو إدخال مبلغ صحيح' : 'Please select or enter a valid amount'
      );
      return;
    }
    if (amount > 500) {
      showAlert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'الحد الأقصى للشحن 500 د.أ' : 'Max top-up amount is 500 JOD'
      );
      return;
    }

    setStripeLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.functions.invoke('create-wallet-topup', {
        body: { amount_jod: amount },
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const text = await error.context?.text();
            const parsed = JSON.parse(text ?? '{}');
            msg = parsed.error ?? text ?? msg;
          } catch { /* use original */ }
        }
        showAlert(language === 'ar' ? 'خطأ في الدفع' : 'Payment Error', msg);
        return;
      }

      if (data?.url) {
        setShowTopUp(false);
        // Open Stripe Checkout in in-app browser
        await WebBrowser.openBrowserAsync(data.url, {
          dismissButtonStyle: 'cancel',
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FORM_SHEET,
        });
        // After browser closes, refresh wallet in case payment completed
        await refreshWallet();
      }
    } catch (e: any) {
      showAlert(
        language === 'ar' ? 'خطأ' : 'Error',
        e?.message ?? (language === 'ar' ? 'حدث خطأ غير متوقع' : 'Unexpected error occurred')
      );
    } finally {
      setStripeLoading(false);
    }
  };

  const filtered = filter === 'all' ? transactions : transactions.filter((tx) => tx.type === filter);

  const renderTransaction = ({ item, index }: { item: Transaction; index: number }) => {
    const isIncoming = item.type === 'topup' || item.type === 'credit' || item.type === 'refund';
    const color = TX_COLORS[item.type];
    return (
      <View style={[styles.txCard, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <View style={[styles.txIcon, { backgroundColor: color + '20', borderColor: color + '40' }]}>
          <MaterialIcons name={item.icon as any} size={20} color={color} />
        </View>
        <View style={[styles.txInfo, { alignItems: isRTL ? 'flex-end' : 'flex-start' }]}>
          <Text style={styles.txTitle}>{language === 'ar' ? item.titleAr : item.titleEn}</Text>
          <Text style={styles.txDesc} numberOfLines={1}>{language === 'ar' ? item.descAr : item.descEn}</Text>
          <Text style={styles.txDate}>{item.date}</Text>
        </View>
        <Text style={[styles.txAmount, { color }]}>
          {isIncoming ? '+' : '-'}{item.amountJOD.toFixed(3)} {language === 'ar' ? 'د.أ' : 'JOD'}
        </Text>
      </View>
    );
  };

  const filterLabels: { key: typeof filter; ar: string; en: string }[] = [
    { key: 'all', ar: 'الكل', en: 'All' },
    { key: 'topup', ar: 'شحن', en: 'Top-up' },
    { key: 'debit', ar: 'مدفوعات', en: 'Paid' },
    { key: 'credit', ar: 'مكافآت', en: 'Rewards' },
    { key: 'refund', ar: 'استرداد', en: 'Refund' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <MaterialIcons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={Colors.gold} />
        </Pressable>
        <Text style={styles.headerTitle}>{language === 'ar' ? 'محفظتي' : 'My Wallet'}</Text>
        <Pressable style={styles.backBtn} onPress={refreshWallet}>
          <MaterialIcons name="refresh" size={20} color={Colors.textMuted} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceGlow} />
          <Text style={[styles.balanceLabel, { textAlign: 'center' }]}>
            {language === 'ar' ? 'الرصيد الحالي' : 'Current Balance'}
          </Text>
          <Animated.Text style={[styles.balanceAmount, { transform: [{ scale: scaleAnim }] }]}>
            {balanceJOD.toFixed(3)}
          </Animated.Text>
          <Text style={styles.balanceCurrency}>{language === 'ar' ? 'دينار أردني' : 'Jordanian Dinar'}</Text>

          {/* Quick Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialIcons name="trending-up" size={16} color={Colors.success} />
              <Text style={styles.statVal}>
                {transactions.filter((tx) => tx.type === 'topup' || tx.type === 'credit' || tx.type === 'refund')
                  .reduce((s, tx) => s + tx.amountJOD, 0).toFixed(3)}
              </Text>
              <Text style={styles.statLbl}>{language === 'ar' ? 'إجمالي الوارد' : 'Total In'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <MaterialIcons name="trending-down" size={16} color={Colors.error} />
              <Text style={styles.statVal}>
                {transactions.filter((tx) => tx.type === 'debit')
                  .reduce((s, tx) => s + tx.amountJOD, 0).toFixed(3)}
              </Text>
              <Text style={styles.statLbl}>{language === 'ar' ? 'إجمالي الصادر' : 'Total Out'}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={[styles.actionRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Pressable style={styles.actionBtn} onPress={() => setShowTopUp(true)}>
              <View style={styles.actionIconBox}>
                <MaterialIcons name="add" size={22} color={Colors.textOnGold} />
              </View>
              <Text style={styles.actionLabel}>{language === 'ar' ? 'إضافة رصيد' : 'Add Funds'}</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={handleShare}>
              <View style={[styles.actionIconBox, styles.actionIconOutline]}>
                <MaterialIcons name="share" size={22} color={Colors.gold} />
              </View>
              <Text style={styles.actionLabel}>{language === 'ar' ? 'مشاركة' : 'Share'}</Text>
            </Pressable>
            <Pressable style={styles.actionBtn} onPress={() => router.push('/booking')}>
              <View style={[styles.actionIconBox, styles.actionIconOutline]}>
                <MaterialIcons name="directions-car" size={22} color={Colors.gold} />
              </View>
              <Text style={styles.actionLabel}>{language === 'ar' ? 'احجز رحلة' : 'Book Ride'}</Text>
            </Pressable>
          </View>
        </View>

        {/* Referral Code Card */}
        <View style={styles.referralCard}>
          <View style={[styles.referralHeader, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <MaterialIcons name="card-giftcard" size={20} color={Colors.gold} />
            <Text style={styles.referralTitle}>
              {language === 'ar' ? 'كود الإحالة الشخصي' : 'Your Personal Referral Code'}
            </Text>
          </View>
          <Text style={[styles.referralDesc, { textAlign: isRTL ? 'right' : 'left' }]}>
            {language === 'ar'
              ? 'شارك كودك واحصل على 2 د.أ لكل صديق ينضم إلى طريق'
              : 'Share your code and earn 2 JOD for every friend who joins Tariq'}
          </Text>
          <View style={[styles.codeBox, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={styles.codeText} selectable>{referralCode}</Text>
            <Pressable style={[styles.copyBtn, codeCopied && styles.copyBtnActive]} onPress={handleCopyCode}>
              <MaterialIcons name={codeCopied ? 'check' : 'content-copy'} size={18} color={codeCopied ? Colors.textOnGold : Colors.gold} />
              <Text style={[styles.copyBtnText, codeCopied && { color: Colors.textOnGold }]}>
                {codeCopied ? (language === 'ar' ? 'تم!' : 'Done!') : (language === 'ar' ? 'نسخ' : 'Copy')}
              </Text>
            </Pressable>
          </View>
          <Pressable style={styles.shareReferralBtn} onPress={handleShare}>
            <MaterialIcons name="share" size={16} color={Colors.gold} />
            <Text style={styles.shareReferralText}>
              {language === 'ar' ? 'مشاركة الكود مع الأصدقاء' : 'Share Code with Friends'}
            </Text>
          </Pressable>
        </View>

        {/* Transaction History */}
        <View style={styles.txSection}>
          <Text style={[styles.sectionTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
            {language === 'ar' ? 'سجل المعاملات' : 'Transaction History'}
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}
            contentContainerStyle={[styles.filterRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            {filterLabels.map((f) => (
              <Pressable key={f.key} style={[styles.filterChip, filter === f.key && styles.filterChipActive]} onPress={() => setFilter(f.key)}>
                <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>
                  {language === 'ar' ? f.ar : f.en}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="receipt-long" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>{language === 'ar' ? 'لا توجد معاملات' : 'No transactions'}</Text>
            </View>
          ) : (
            <View style={styles.txList}>
              {filtered.map((item, index) => (
                <View key={item.id}>
                  {renderTransaction({ item, index })}
                  {index < filtered.length - 1 && <View style={styles.txDivider} />}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Top-Up Modal ─────────────────────────────────────────────────────── */}
      <Modal visible={showTopUp} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowTopUp(false)} />
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + Spacing.base }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{language === 'ar' ? 'إضافة رصيد' : 'Add Funds'}</Text>
            <Text style={[styles.modalSub, { textAlign: isRTL ? 'right' : 'left' }]}>
              {language === 'ar' ? 'اختر المبلغ الذي تريد إضافته' : 'Choose the amount to add'}
            </Text>

            {/* Preset Amounts */}
            <View style={[styles.amountsGrid, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              {TOP_UP_AMOUNTS.map((amt) => (
                <Pressable
                  key={amt}
                  style={[styles.amountChip, selectedAmount === amt && styles.amountChipActive]}
                  onPress={() => { setSelectedAmount(amt); setCustomAmount(''); }}
                >
                  <Text style={[styles.amountChipText, selectedAmount === amt && styles.amountChipTextActive]}>
                    {amt} {language === 'ar' ? 'د.أ' : 'JOD'}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.orLabel, { textAlign: 'center' }]}>
              {language === 'ar' ? '— أو أدخل مبلغاً مخصصاً —' : '— or enter custom amount —'}
            </Text>

            <TextInput
              style={[styles.customInput, { textAlign: isRTL ? 'right' : 'left' }]}
              value={customAmount}
              onChangeText={(v) => { setCustomAmount(v); setSelectedAmount(null); }}
              placeholder={language === 'ar' ? 'مبلغ مخصص (د.أ)' : 'Custom amount (JOD)'}
              placeholderTextColor={Colors.textMuted}
              keyboardType="decimal-pad"
            />

            {/* Stripe Badge */}
            <View style={styles.stripeBadge}>
              <MaterialIcons name="lock" size={14} color={Colors.success} />
              <Text style={styles.stripeBadgeText}>
                {language === 'ar'
                  ? 'دفع آمن ومشفر عبر Stripe · Visa / Mastercard / Apple Pay'
                  : 'Secure payment via Stripe · Visa / Mastercard / Apple Pay'}
              </Text>
            </View>

            {/* Stripe Pay Button */}
            <Pressable
              style={[styles.stripeBtn, stripeLoading && { opacity: 0.6 }]}
              onPress={handleStripeTopUp}
              disabled={stripeLoading}
            >
              {stripeLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons name="payment" size={20} color="#fff" />
                  <Text style={styles.stripeBtnText}>
                    {language === 'ar' ? 'الدفع عبر Stripe' : 'Pay with Stripe'}
                  </Text>
                </>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelTopUpBtn}
              onPress={() => { setShowTopUp(false); setSelectedAmount(null); setCustomAmount(''); }}
            >
              <Text style={styles.cancelTopUpText}>{language === 'ar' ? 'إلغاء' : 'Cancel'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.surfaceCard, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  headerTitle: { color: Colors.textPrimary, fontSize: Typography.sizes.lg, fontWeight: Typography.weights.bold },

  // Balance Card
  balanceCard: {
    margin: Spacing.base, backgroundColor: Colors.surfaceCard, borderRadius: Radius.xxl,
    padding: Spacing.xl, borderWidth: 1, borderColor: Colors.borderGold,
    alignItems: 'center', gap: Spacing.md, overflow: 'hidden', ...Shadows.gold,
  },
  balanceGlow: {
    position: 'absolute', top: -40, width: 200, height: 200, borderRadius: 100,
    backgroundColor: Colors.gold + '12',
  },
  balanceLabel: { color: Colors.textSecondary, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.medium },
  balanceAmount: { color: Colors.gold, fontSize: 52, fontWeight: Typography.weights.extraBold, letterSpacing: -1 },
  balanceCurrency: { color: Colors.textMuted, fontSize: Typography.sizes.sm, marginTop: -Spacing.md },

  statsRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xl,
    backgroundColor: Colors.surfaceElevated, borderRadius: Radius.lg,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl,
    borderWidth: 1, borderColor: Colors.border, width: '100%', justifyContent: 'center',
  },
  statItem: { alignItems: 'center', gap: 3 },
  statVal: { color: Colors.textPrimary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.bold },
  statLbl: { color: Colors.textMuted, fontSize: Typography.sizes.xs },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },

  actionRow: { gap: Spacing.lg, justifyContent: 'center', width: '100%' },
  actionBtn: { flex: 1, alignItems: 'center', gap: Spacing.sm },
  actionIconBox: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center', ...Shadows.gold,
  },
  actionIconOutline: { backgroundColor: Colors.goldFaint, borderWidth: 1.5, borderColor: Colors.borderGold },
  actionLabel: { color: Colors.textSecondary, fontSize: Typography.sizes.xs, fontWeight: Typography.weights.medium },

  // Referral
  referralCard: {
    marginHorizontal: Spacing.base, marginBottom: Spacing.base,
    backgroundColor: Colors.surfaceCard, borderRadius: Radius.xl,
    padding: Spacing.base, borderWidth: 1, borderColor: Colors.borderGold, gap: Spacing.md,
  },
  referralHeader: { alignItems: 'center', gap: Spacing.sm },
  referralTitle: { color: Colors.textPrimary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.semiBold },
  referralDesc: { color: Colors.textSecondary, fontSize: Typography.sizes.sm },
  codeBox: {
    alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.goldFaint, borderRadius: Radius.lg,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    borderWidth: 1.5, borderColor: Colors.borderGold, borderStyle: 'dashed', gap: Spacing.md,
  },
  codeText: { color: Colors.gold, fontSize: Typography.sizes.xl, fontWeight: Typography.weights.extraBold, letterSpacing: 3, flex: 1 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.xs,
    backgroundColor: Colors.goldFaint, borderRadius: Radius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.borderGold, minHeight: 40,
  },
  copyBtnActive: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  copyBtnText: { color: Colors.gold, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.semiBold },
  shareReferralBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.border, marginTop: Spacing.xs,
  },
  shareReferralText: { color: Colors.gold, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.medium },

  // Transactions
  txSection: { paddingHorizontal: Spacing.base, gap: Spacing.base },
  sectionTitle: { color: Colors.textPrimary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.bold },
  filterScroll: { marginHorizontal: -Spacing.base },
  filterRow: { gap: Spacing.sm, paddingHorizontal: Spacing.base },
  filterChip: {
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderRadius: Radius.full, borderWidth: 1.5, borderColor: Colors.border,
    backgroundColor: Colors.surfaceCard, minHeight: 38, justifyContent: 'center',
  },
  filterChipActive: { backgroundColor: Colors.goldFaint, borderColor: Colors.gold },
  filterChipText: { color: Colors.textSecondary, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.medium },
  filterChipTextActive: { color: Colors.gold, fontWeight: Typography.weights.semiBold },
  txList: {
    backgroundColor: Colors.surfaceCard, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border, overflow: 'hidden', marginBottom: Spacing.base,
  },
  txCard: { alignItems: 'center', gap: Spacing.md, padding: Spacing.base, minHeight: 72 },
  txIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, flexShrink: 0,
  },
  txInfo: { flex: 1, gap: 2 },
  txTitle: { color: Colors.textPrimary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.semiBold },
  txDesc: { color: Colors.textSecondary, fontSize: Typography.sizes.sm },
  txDate: { color: Colors.textMuted, fontSize: Typography.sizes.xs, marginTop: 2 },
  txAmount: { fontSize: Typography.sizes.base, fontWeight: Typography.weights.bold, flexShrink: 0 },
  txDivider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.base },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxxl, gap: Spacing.base },
  emptyText: { color: Colors.textSecondary, fontSize: Typography.sizes.base },

  // Modal
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalSheet: {
    backgroundColor: Colors.surface, borderTopLeftRadius: Radius.xxl, borderTopRightRadius: Radius.xxl,
    padding: Spacing.xl, gap: Spacing.base, borderTopWidth: 1, borderTopColor: Colors.borderGold,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: Spacing.sm,
  },
  modalTitle: { color: Colors.textPrimary, fontSize: Typography.sizes.xl, fontWeight: Typography.weights.bold, textAlign: 'center' },
  modalSub: { color: Colors.textSecondary, fontSize: Typography.sizes.sm },
  amountsGrid: { flexWrap: 'wrap', gap: Spacing.sm },
  amountChip: {
    flex: 1, minWidth: '45%', alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.surfaceCard, minHeight: 52,
  },
  amountChipActive: { backgroundColor: Colors.goldFaint, borderColor: Colors.gold },
  amountChipText: { color: Colors.textSecondary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.semiBold },
  amountChipTextActive: { color: Colors.gold, fontWeight: Typography.weights.bold },
  orLabel: { color: Colors.textMuted, fontSize: Typography.sizes.sm },
  customInput: {
    backgroundColor: Colors.surfaceCard, borderRadius: Radius.lg,
    borderWidth: 1.5, borderColor: Colors.borderGold,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    color: Colors.textPrimary, fontSize: Typography.sizes.lg, fontWeight: Typography.weights.bold, minHeight: 54,
  },
  stripeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.success + '15', borderRadius: Radius.md,
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.success + '30',
  },
  stripeBadgeText: { color: Colors.success, fontSize: Typography.sizes.xs, flex: 1 },
  stripeBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: '#635BFF', borderRadius: Radius.full,
    paddingVertical: Spacing.md, minHeight: 56,
  },
  stripeBtnText: { color: '#fff', fontSize: Typography.sizes.base, fontWeight: Typography.weights.bold },
  cancelTopUpBtn: { alignItems: 'center', paddingVertical: Spacing.sm, minHeight: 44 },
  cancelTopUpText: { color: Colors.textMuted, fontSize: Typography.sizes.base },
});
