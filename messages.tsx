import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLanguage } from '@/hooks/useLanguage';
import { useAuth } from '@/hooks/useAuth';
import { useRide } from '@/hooks/useRide';
import { getSupabaseClient } from '@/template';
import { Colors, Typography, Spacing, Radius, Shadows } from '@/constants/theme';

interface DBMessage {
  id: string;
  ride_id: string;
  sender_id: string;
  sender_role: 'passenger' | 'captain';
  message: string;
  created_at: string;
}

const POLL_INTERVAL_MS = 3000;

export default function MessagesScreen() {
  const { t, language, isRTL } = useLanguage();
  const { user } = useAuth();
  const { rideStatus, lastCompletedRideId } = useRide();
  const insets = useSafeAreaInsets();
  const supabase = getSupabaseClient();

  const [messages, setMessages] = useState<DBMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeRideId, setActiveRideId] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Determine active ride id ──────────────────────────────────────────────
  useEffect(() => {
    const fetchLatestActiveRide = async () => {
      if (!user?.id) { setLoading(false); return; }

      const activeStatuses = ['found', 'arriving', 'inProgress'];
      const isActiveRide = activeStatuses.includes(rideStatus);

      if (isActiveRide) {
        // Get the latest ride from DB
        const { data } = await supabase
          .from('ride_history')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (data?.id) setActiveRideId(data.id);
      } else if (lastCompletedRideId) {
        setActiveRideId(lastCompletedRideId);
      } else {
        // Show the most recent ride's chat
        const { data } = await supabase
          .from('ride_history')
          .select('id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();
        if (data?.id) setActiveRideId(data.id);
      }
      setLoading(false);
    };

    fetchLatestActiveRide();
  }, [user?.id, rideStatus, lastCompletedRideId]);

  // ── Fetch messages ────────────────────────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!activeRideId) return;
    const { data, error } = await supabase
      .from('ride_messages')
      .select('*')
      .eq('ride_id', activeRideId)
      .order('created_at', { ascending: true });
    if (!error && data) {
      setMessages((prev) => {
        // Only update if changed (avoid flicker)
        if (JSON.stringify(prev.map((m) => m.id)) === JSON.stringify(data.map((m: DBMessage) => m.id))) {
          return prev;
        }
        return data as DBMessage[];
      });
    }
  }, [activeRideId]);

  // ── Start polling ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeRideId) return;
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [activeRideId, fetchMessages]);

  // ── Auto-scroll on new messages ───────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !activeRideId || !user?.id || sending) return;

    setSending(true);
    setInputText('');

    const optimistic: DBMessage = {
      id: `opt_${Date.now()}`,
      ride_id: activeRideId,
      sender_id: user.id,
      sender_role: 'passenger',
      message: text,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const { error } = await supabase.from('ride_messages').insert({
      ride_id: activeRideId,
      sender_id: user.id,
      sender_role: 'passenger',
      message: text,
    });

    if (error) {
      // Remove optimistic on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
    } else {
      // Refresh to get real id from DB
      await fetchMessages();
    }
    setSending(false);
  };

  // ── Render helpers ────────────────────────────────────────────────────────
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(language === 'ar' ? 'ar-JO' : 'en-JO', {
      hour: '2-digit', minute: '2-digit',
    });
  };

  const isActiveRide = ['found', 'arriving', 'inProgress'].includes(rideStatus);

  const renderMessage = ({ item }: { item: DBMessage }) => {
    const isMe = item.sender_role === 'passenger';
    return (
      <View style={[
        styles.msgRow,
        isMe
          ? (isRTL ? styles.msgRowLeftRTL : styles.msgRowRight)
          : (isRTL ? styles.msgRowRightRTL : styles.msgRowLeft),
      ]}>
        {!isMe ? (
          <View style={styles.captainAvatar}>
            <MaterialIcons name="person" size={16} color={Colors.gold} />
          </View>
        ) : null}
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.theirBubble]}>
          <Text style={[styles.bubbleText, isMe ? styles.myBubbleText : styles.theirBubbleText]}>
            {item.message}
          </Text>
          <Text style={[styles.bubbleTime, isMe ? styles.myBubbleTime : styles.theirBubbleTime]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  // ── Empty / loading states ────────────────────────────────────────────────
  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator color={Colors.gold} size="large" />
        </View>
      );
    }
    if (!activeRideId) {
      return (
        <View style={styles.centerState}>
          <MaterialIcons name="chat-bubble-outline" size={64} color={Colors.textMuted} />
          <Text style={[styles.emptyTitle, { textAlign: isRTL ? 'right' : 'left' }]}>
            {language === 'ar' ? 'لا توجد محادثات' : 'No Conversations'}
          </Text>
          <Text style={[styles.emptySubtitle, { textAlign: 'center' }]}>
            {language === 'ar'
              ? 'ستظهر محادثتك مع الكابتن هنا عند بدء الرحلة'
              : 'Your captain chat will appear here when you start a ride'}
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.centerState}>
        <MaterialIcons name="chat" size={52} color={Colors.redDim} />
        <Text style={styles.emptyTitle}>
          {language === 'ar' ? 'ابدأ المحادثة' : 'Start the conversation'}
        </Text>
        <Text style={[styles.emptySubtitle, { textAlign: 'center' }]}>
          {language === 'ar' ? 'أرسل رسالة للكابتن' : 'Send a message to your captain'}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.bottom + 10}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={[styles.header, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { textAlign: isRTL ? 'right' : 'left' }]}>
              {t('chatHistory')}
            </Text>
            {activeRideId ? (
              <Text style={[styles.subtitle, { textAlign: isRTL ? 'right' : 'left' }]}>
                {isActiveRide
                  ? (language === 'ar' ? 'رحلة جارية • يتم التحديث كل 3 ثوانٍ' : 'Active ride • Updating every 3s')
                  : (language === 'ar' ? 'آخر رحلة' : 'Latest ride')}
              </Text>
            ) : null}
          </View>

          {/* Live indicator */}
          {isActiveRide && activeRideId ? (
            <View style={styles.liveBadge}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>{language === 'ar' ? 'مباشر' : 'LIVE'}</Text>
            </View>
          ) : null}
        </View>

        {/* Captain info bar (only when active) */}
        {isActiveRide && activeRideId ? (
          <View style={[styles.captainBar, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <View style={styles.captainAvatarLg}>
              <MaterialIcons name="person" size={24} color={Colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.captainName, { textAlign: isRTL ? 'right' : 'left' }]}>
                {language === 'ar' ? 'الكابتن' : 'Captain'}
              </Text>
              <View style={[styles.onlineRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <View style={styles.onlineDot} />
                <Text style={styles.onlineText}>
                  {language === 'ar' ? 'متاح للدردشة' : 'Available'}
                </Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* ── Messages List ───────────────────────────────────────────────── */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            messages.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
        />

        {/* ── Input Bar ───────────────────────────────────────────────────── */}
        {activeRideId ? (
          <View style={[styles.inputBar, { paddingBottom: insets.bottom + 8 }]}>
            <TextInput
              style={[
                styles.textInput,
                { textAlign: isRTL ? 'right' : 'left' },
              ]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={t('typeMessage')}
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={500}
              returnKeyType="send"
              onSubmitEditing={handleSend}
            />
            <Pressable
              style={[styles.sendBtn, (!inputText.trim() || sending) && styles.sendBtnDisabled]}
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
            >
              {sending
                ? <ActivityIndicator size="small" color={Colors.textOnGold} />
                : <MaterialIcons name="send" size={20} color={Colors.textOnGold} />}
            </Pressable>
          </View>
        ) : (
          <View style={{ height: insets.bottom + 16 }} />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  // ── Header ──
  header: {
    paddingHorizontal: Spacing.base, paddingTop: Spacing.base, paddingBottom: Spacing.sm,
    alignItems: 'center', gap: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  title: { color: Colors.textPrimary, fontSize: Typography.sizes.xxl, fontWeight: Typography.weights.bold },
  subtitle: { color: Colors.textMuted, fontSize: Typography.sizes.xs, marginTop: 2 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: Colors.redFaint, borderRadius: Radius.full,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
    borderWidth: 1, borderColor: Colors.red,
  },
  liveDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.red,
  },
  liveText: { color: Colors.red, fontSize: Typography.sizes.xs, fontWeight: Typography.weights.bold },

  // ── Captain Bar ──
  captainBar: {
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.md,
    backgroundColor: Colors.surfaceCard, borderBottomWidth: 1, borderBottomColor: Colors.border,
    alignItems: 'center', gap: Spacing.md,
  },
  captainAvatarLg: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.goldFaint, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.gold,
  },
  captainName: { color: Colors.textPrimary, fontSize: Typography.sizes.base, fontWeight: Typography.weights.semiBold },
  onlineRow: { alignItems: 'center', gap: 5, marginTop: 2 },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.success },
  onlineText: { color: Colors.success, fontSize: Typography.sizes.xs },

  // ── Messages List ──
  listContent: {
    paddingHorizontal: Spacing.base, paddingVertical: Spacing.base, gap: Spacing.sm,
    paddingBottom: 16,
  },
  listContentEmpty: { flex: 1 },
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, marginVertical: 2 },
  msgRowRight: { justifyContent: 'flex-end' },
  msgRowLeft: { justifyContent: 'flex-start' },
  msgRowRightRTL: { justifyContent: 'flex-start' },
  msgRowLeftRTL: { justifyContent: 'flex-end' },
  captainAvatar: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.goldFaint, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.borderGold,
  },
  bubble: {
    maxWidth: '72%', borderRadius: Radius.lg, paddingHorizontal: Spacing.base, paddingVertical: Spacing.sm,
    gap: 4,
  },
  myBubble: {
    backgroundColor: Colors.primary, borderBottomRightRadius: 4,
    ...Shadows.red,
  },
  theirBubble: {
    backgroundColor: Colors.surfaceCard, borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: Colors.border,
  },
  bubbleText: { fontSize: Typography.sizes.base, lineHeight: 22 },
  myBubbleText: { color: Colors.textOnRed },
  theirBubbleText: { color: Colors.textPrimary },
  bubbleTime: { fontSize: Typography.sizes.xs },
  myBubbleTime: { color: 'rgba(255,255,255,0.65)', textAlign: 'right' },
  theirBubbleTime: { color: Colors.textMuted },

  // ── Empty / Loading ──
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xxl },
  emptyTitle: { color: Colors.textPrimary, fontSize: Typography.sizes.xl, fontWeight: Typography.weights.bold },
  emptySubtitle: { color: Colors.textMuted, fontSize: Typography.sizes.base, lineHeight: 24, maxWidth: 280 },

  // ── Input Bar ──
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm,
    paddingHorizontal: Spacing.base, paddingTop: Spacing.sm,
    backgroundColor: Colors.surface, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  textInput: {
    flex: 1, backgroundColor: Colors.surfaceCard,
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.xl,
    paddingHorizontal: Spacing.base, paddingTop: 10, paddingBottom: 10,
    color: Colors.textPrimary, fontSize: Typography.sizes.base,
    maxHeight: 100, minHeight: 44,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    ...Shadows.red,
  },
  sendBtnDisabled: { backgroundColor: Colors.redDim, opacity: 0.5 },
});
