
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, Pressable, Image, Animated,
} from 'react-native';
import { MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { useAlert } from '@/template';
import { GoldButton } from '@/components/ui/GoldButton';
import { GoldInput } from '@/components/ui/GoldInput';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import {
  isBiometricHardwareAvailable,
  getBiometricType,
  authenticateWithBiometric,
  getSessionFromSecureStore,
  isBiometricEnabled,
  getLastPhone,
  BiometricType,
} from '@/services/biometricService';

type Step = 'main' | 'otp';

export default function LoginScreen() {
  const { setSessionFromOTP, restoreSessionFromBiometric, enableBiometric, biometricEnabled } = useAuth();
  const { t, language, toggleLanguage, isRTL } = useLanguage();
  const { showAlert } = useAlert();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [step, setStep] = useState<Step>('main');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [biometricLoading, setBiometricLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [showBiometricOption, setShowBiometricOption] = useState(false);
  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const [cachedPhone, setCachedPhone] = useState('');
  const [showEnableBiometric, setShowEnableBiometric] = useState(false);
  const [lastEmail, setLastEmail] = useState('');

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const cardAnim = useRef(new Animated.Value(60)).current;
  const biometricPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, tension: 70, friction: 10, useNativeDriver: true }),
      ]),
      Animated.spring(cardAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();

    // Check biometric availability
    checkBiometricStatus();
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Pulse animation for biometric button
  useEffect(() => {
    if (showBiometricOption) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(biometricPulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
          Animated.timing(biometricPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [showBiometricOption]);

  const checkBiometricStatus = async () => {
    const hw = await isBiometricHardwareAvailable();
    if (!hw) return;

    const type = await getBiometricType();
    setBiometricType(type);

    const enabled = await isBiometricEnabled();
    const storedSession = await getSessionFromSecureStore();
    const lastPhone = await getLastPhone();

    if (enabled && storedSession) {
      setShowBiometricOption(true);
      setCachedPhone(lastPhone);
    }
  };

  const handleSendOtp_unused = async () => {};
  // The error was an extra closing curly brace here, closing the LoginScreen component prematurely.
  // It has been removed.

  const handleBiometricLogin = async () => {
    setBiometricLoading(true);
    try {
      const msgAr = biometricType === 'face' ? 'سجّل الدخول بالوجه' : 'سجّل الدخول ببصمة الإصبع';
      const result = await authenticateWithBiometric(msgAr);

      if (!result.success) {
        showAlert(
          language === 'ar' ? 'فشل التحقق' : 'Authentication Failed',
          result.error ?? (language === 'ar' ? 'حاول مجدداً' : 'Please try again')
        );
        return;
      }

      const restored = await restoreSessionFromBiometric();
      if (restored) {
        router.replace('/(tabs)');
      } else {
        setShowBiometricOption(false);
        showAlert(
          language === 'ar' ? 'انتهت الجلسة' : 'Session Expired',
          language === 'ar' ? 'يرجى إعادة تسجيل الدخول برقم هاتفك' : 'Please sign in again with your phone number'
        );
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleSendOtp = async () => {
    const emailVal = email.trim().toLowerCase();
    if (!emailVal.includes('@') || !emailVal.includes('.')) {
      showAlert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'يرجى إدخال بريد إلكتروني صحيح' : 'Please enter a valid email address'
      );
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: emailVal });
      if (error) {
        showAlert(language === 'ar' ? 'خطأ' : 'Error', error.message);
        return;
      }
      setLastEmail(emailVal);
      setStep('otp');
      setCountdown(60);
    } catch (e: any) {
      showAlert(language === 'ar' ? 'خطأ' : 'Error', e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (otp.trim().length < 4) {
      showAlert(
        language === 'ar' ? 'خطأ' : 'Error',
        language === 'ar' ? 'يرجى إدخال رمز التحقق' : 'Please enter the OTP code'
      );
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: lastEmail,
        token: otp.trim(),
        type: 'email',
      });

      if (error) {
        showAlert(language === 'ar' ? 'خطأ' : 'Error', error.message);
        return;
      }

      if (data?.session) {
        await setSessionFromOTP(data.session, lastEmail);

        // Offer to enable biometric if available and not yet enabled
        const hw = await isBiometricHardwareAvailable();
        const alreadyEnabled = await isBiometricEnabled();
        if (hw && !alreadyEnabled) {
          setShowEnableBiometric(true);
        } else {
          router.replace('/(tabs)');
        }
      } else {
        showAlert(language === 'ar' ? 'خطأ' : 'Error', language === 'ar' ? 'لم يتم إنشاء الجلسة' : 'Session not created');
      }
    } catch (e: any) {
      showAlert(language === 'ar' ? 'خطأ' : 'Error', e.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const handleEnableBiometric = async (enable: boolean) => {
    if (enable) {
      await enableBiometric();
    }
    setShowEnableBiometric(false);
    router.replace('/(tabs)');
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    if (lastEmail) {
      setLoading(true);
      await supabase.auth.signInWithOtp({ email: lastEmail });
      setLoading(false);
      setCountdown(60);
    }
  };

  const biometricIcon: any = biometricType === 'face' ? 'face-recognition' : 'fingerprint';
  const biometricLabel = biometricType === 'face'
    ? (language === 'ar' ? 'الدخول بالوجه' : 'Face ID')
    : (language === 'ar' ? 'الدخول بالبصمة' : 'Fingerprint');

  // ── Enable Biometric prompt overlay ──────────────────────────────────────
  if (showEnableBiometric) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <LinearGradient colors={['#6B0010', '#AA0A18', '#1A0005', '#0D0002']} locations={[0, 0.35, 0.7, 1]} style={styles.gradient} />
        <View style={styles.biometricPromptWrap}>
          <View style={styles.biometricPromptCard}>
            <View style={styles.biometricPromptIcon}>
              <MaterialCommunityIcons name={biometricIcon} size={56} color={Colors.gold} />
            </View>
            <Text style={styles.biometricPromptTitle}>
              {language === 'ar' ? `تفعيل ${biometricLabel}؟` : `Enable ${biometricLabel}?`}
            </Text>
            <Text style={styles.biometricPromptSub}>
              {language === 'ar'
                ? 'أدخل التطبيق بسرعة وأمان في المرات القادمة دون الحاجة لإدخال رقم هاتفك'
                : 'Sign in quickly and securely next time without entering your phone number'}
            </Text>
            <GoldButton
              label={language === 'ar' ? 'نعم، تفعيل' : 'Yes, Enable'}
              onPress={() => handleEnableBiometric(true)}
              size="lg"
              style={{ marginTop: Spacing.md }}
            />
            <Pressable style={styles.skipBtn} onPress={() => handleEnableBiometric(false)}>
              <Text style={styles.skipText}>{language === 'ar' ? 'ليس الآن' : 'Not Now'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={['#6B0010', '#AA0A18', '#1A0005', '#0D0002']}
        locations={[0, 0.35, 0.7, 1]}
        style={styles.gradient}
      />

      <Pressable style={styles.langBtn} onPress={toggleLanguage}>
        <MaterialIcons name="language" size={16} color={Colors.gold} />
        <Text style={styles.langText}>{language === 'ar' ? 'EN' : 'ع'}</Text>
      </Pressable>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          {/* Logo & Branding */}
          <Animated.View style={[styles.topSection, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
            <View style={styles.logoContainer}>
              <View style={styles.logoGlow} />
              <Image source={require('@/assets/images/logo.png')} style={styles.logoImage} resizeMode="contain" />
            </View>
            <Text style={styles.appName}>طريقي</Text>
            <Text style={styles.subtitle}>{t('appTagline')}</Text>
          </Animated.View>

          {/* Biometric Quick Login */}
          {showBiometricOption && step === 'main' ? (
            <Animated.View style={[styles.biometricSection, { opacity: fadeAnim, transform: [{ translateY: cardAnim }] }]}>
              <Pressable
                style={styles.biometricCard}
                onPress={handleBiometricLogin}
                disabled={biometricLoading}
              >
                <LinearGradient
                  colors={['rgba(201,168,76,0.15)', 'rgba(201,168,76,0.05)']}
                  style={StyleSheet.absoluteFill}
                />
                <Animated.View style={{ transform: [{ scale: biometricPulse }] }}>
                  <View style={styles.biometricIconWrap}>
                    <MaterialCommunityIcons name={biometricIcon} size={44} color={Colors.gold} />
                  </View>
                </Animated.View>
                <View style={{ alignItems: 'center', flex: 1 }}>
                  <Text style={styles.biometricCardTitle}>
                    {language === 'ar' ? `دخول سريع بـ${biometricLabel}` : `Quick Sign In via ${biometricLabel}`}
                  </Text>
                  {cachedPhone ? (
                    <Text style={styles.biometricCardPhone}>{cachedPhone}</Text>
                  ) : null}
                </View>
                {biometricLoading ? (
                  <MaterialIcons name="hourglass-empty" size={22} color={Colors.gold} />
                ) : (
                  <MaterialIcons name="chevron-right" size={22} color={Colors.gold} />
                )}
              </Pressable>

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{language === 'ar' ? 'أو' : 'or'}</Text>
                <View style={styles.dividerLine} />
              </View>
            </Animated.View>
          ) : null}

          {/* Auth Card */}
          <Animated.View style={[styles.card, { opacity: fadeAnim, transform: [{ translateY: cardAnim }] }]}>
            {step === 'main' ? (
              <>
                <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                  <Text style={styles.cardTitle}>
                    {language === 'ar' ? 'أدخل بريدك الإلكتروني' : 'Enter your email'}
                  </Text>
                  <Text style={styles.cardSub}>
                    {language === 'ar'
                      ? 'سنرسل لك رمز تحقق على بريدك الإلكتروني'
                      : 'We will send you a verification code via email'}
                  </Text>
                </View>

                <GoldInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={language === 'ar' ? 'example@email.com' : 'example@email.com'}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  textAlign={isRTL ? 'right' : 'left'}
                />

                <GoldButton
                  label={language === 'ar' ? 'إرسال رمز التحقق' : 'Send Code'}
                  onPress={handleSendOtp}
                  loading={loading}
                  size="lg"
                  style={{ marginTop: Spacing.sm }}
                />
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => { setStep('main'); setOtp(''); }}
                  style={[styles.backRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
                >
                  <MaterialIcons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={20} color={Colors.gold} />
                  <Text style={styles.backText}>{t('back')}</Text>
                </Pressable>

                <View style={{ alignItems: isRTL ? 'flex-end' : 'flex-start' }}>
                  <Text style={styles.otpTitle}>{t('enterOtp')}</Text>
                  <Text style={styles.otpSub}>
                    {language === 'ar' ? 'تم الإرسال إلى' : 'Sent to'} {lastEmail}
                  </Text>
                </View>

                <GoldInput
                  value={otp}
                  onChangeText={setOtp}
                  placeholder="• • • • • •"
                  keyboardType="numeric"
                  maxLength={6}
                  textAlign="center"
                  autoFocus
                  style={{ marginTop: Spacing.md }}
                />
                <GoldButton
                  label={t('verify')}
                  onPress={handleVerifyOtp}
                  loading={loading}
                  size="lg"
                  style={{ marginTop: Spacing.sm }}
                />
                <Pressable
                  onPress={handleResend}
                  disabled={countdown > 0}
                  style={styles.resendBtn}
                >
                  <Text style={[styles.resendText, countdown > 0 && { color: Colors.textMuted }]}>
                    {countdown > 0 ? `${t('resendOtp')} (${countdown}s)` : t('resendOtp')}
                  </Text>
                </Pressable>
              </>
            )}
          </Animated.View>

          <Animated.Text style={[styles.termsNote, { opacity: fadeAnim }]}>
            {language === 'ar'
              ? 'بتسجيل الدخول توافق على شروط الاستخدام وسياسة الخصوصية'
              : 'By signing in you agree to our Terms of Service and Privacy Policy'}
          </Animated.Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  gradient: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  kav: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.base, paddingBottom: Spacing.xxxl },
  langBtn: {
    position: 'absolute', top: 60, right: Spacing.base, zIndex: 99,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(20,0,5,0.7)', borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderWidth: 1, borderColor: Colors.borderGold,
  },
  langText: { color: Colors.gold, fontSize: Typography.sizes.sm, fontWeight: Typography.weights.bold },
  topSection: { alignItems: 'center', paddingTop: 90, paddingBottom: Spacing.xl, gap: Spacing.sm },
  logoContainer: { width: 120, height: 120, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  logoGlow: {
    position: 'absolute', width: 130, height: 130, borderRadius: 65,
    backgroundColor: 'rgba(204,16,32,0.15)',
    shadowColor: '#CC1020', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6, shadowRadius: 30, elevation: 15,
  },
  logoImage: { width: 120, height: 120 },
  appName: { color: Colors.textPrimary, fontSize: 32, fontWeight: '800', letterSpacing: 1 },
  subtitle: { color: Colors.gold, fontSize: Typography.sizes.md, fontWeight: '500' },

  // Biometric quick login
  biometricSection: { marginBottom: Spacing.sm, gap: Spacing.base },
  biometricCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: 'rgba(26,0,5,0.9)', borderRadius: Radius.xl,
    padding: Spacing.base, borderWidth: 1.5, borderColor: Colors.borderGold,
    overflow: 'hidden', ...Shadows.gold,
  },
  biometricIconWrap: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(201,168,76,0.12)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.borderGold,
  },
  biometricCardTitle: {
    color: Colors.textPrimary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.bold,
    textAlign: 'center',
  },
  biometricCardPhone: { color: Colors.textSecondary, fontSize: Typography.sizes.sm, marginTop: 2 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: Colors.border },
  dividerText: { color: Colors.textMuted, fontSize: Typography.sizes.sm },

  // Auth card
  card: {
    backgroundColor: 'rgba(26,0,5,0.9)', borderRadius: Radius.xxl,
    padding: Spacing.xl, borderWidth: 1, borderColor: 'rgba(204,16,32,0.3)',
    gap: Spacing.base, ...Shadows.deep,
  },
  cardTitle: { color: Colors.textPrimary, fontSize: Typography.sizes.xl, fontWeight: Typography.weights.bold },
  cardSub: { color: Colors.textSecondary, fontSize: Typography.sizes.sm, marginTop: 4 },

  backRow: { alignItems: 'center', gap: Spacing.sm, alignSelf: 'flex-start' },
  backText: { color: Colors.gold, fontSize: Typography.sizes.base, fontWeight: Typography.weights.medium },
  otpTitle: { color: Colors.textPrimary, fontSize: Typography.sizes.xl, fontWeight: Typography.weights.bold },
  otpSub: { color: Colors.textSecondary, fontSize: Typography.sizes.md, marginTop: 4 },
  resendBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  resendText: { color: Colors.gold, fontSize: Typography.sizes.md, fontWeight: Typography.weights.medium },
  termsNote: {
    textAlign: 'center', color: Colors.textMuted, fontSize: Typography.sizes.xs,
    marginTop: Spacing.xl, paddingHorizontal: Spacing.xl, lineHeight: 18,
  },

  // Biometric enable prompt
  biometricPromptWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: Spacing.base },
  biometricPromptCard: {
    backgroundColor: 'rgba(26,0,5,0.95)', borderRadius: Radius.xxl,
    padding: Spacing.xl, borderWidth: 1.5, borderColor: Colors.borderGold,
    alignItems: 'center', gap: Spacing.md, ...Shadows.deep,
  },
  biometricPromptIcon: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: 'rgba(201,168,76,0.1)', borderWidth: 1.5, borderColor: Colors.borderGold,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm,
  },
  biometricPromptTitle: {
    color: Colors.textPrimary, fontSize: Typography.sizes.xxl, fontWeight: Typography.weights.bold, textAlign: 'center',
  },
  biometricPromptSub: {
    color: Colors.textSecondary, fontSize: Typography.sizes.md, textAlign: 'center', lineHeight: 22,
  },
  skipBtn: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl },
  skipText: { color: Colors.textMuted, fontSize: Typography.sizes.md },
});
