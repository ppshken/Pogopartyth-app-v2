// app/chat/ChatRoomScreen.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation } from "expo-router";

import { useChatMessages, formatTimeShort } from "../../../lib/chat_friend";
import { getProfile } from "../../../lib/user";

type RouteParams = {
  thread_id: string;
  other_user_id?: string;
  other_username?: string;
  other_avatar?: string;
};

export default function ChatRoomScreen() {
  const insets = useSafeAreaInsets();
  const nav = useNavigation();
  const params = useLocalSearchParams<RouteParams>();

  const threadId = useMemo(() => Number(params.thread_id || 0), [params.thread_id]);
  const otherUsername = params.other_username || "ผู้ใช้";
  const otherAvatar = params.other_avatar || undefined;

  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  // โหลด current user id
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const me: any = await getProfile();
        if (mounted) setCurrentUserId(Number(me.id));
      } catch {
        // ถ้าโหลดไม่ได้ ควรพาออกจากหน้าหรือแจ้งเตือนจริง ๆ
        if (mounted) setCurrentUserId(null);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ตั้ง header ชื่อห้อง
  useEffect(() => {
    nav.setOptions?.({
      title: otherUsername || "แชท",
      headerRight: () =>
        otherAvatar ? (
          <Image
            source={{ uri: otherAvatar }}
            style={{ width: 32, height: 32, borderRadius: 16, marginRight: 12 }}
          />
        ) : null,
    });
  }, [nav, otherUsername, otherAvatar]);

  const { list, loading, error, hasMore, refresh, loadMore, sendText, sendImageFromAsset } =
    useChatMessages(threadId, 50);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // อ้างอิง FlatList เพื่อเลื่อนท้ายเมื่อมีข้อความใหม่
  const listRef = useRef<FlatList>(null);
  useEffect(() => {
    // เลื่อนลงล่างสุดเมื่อ list อัปเดต (ดีตอนเราพิมพ์/ส่ง)
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  }, [list.length]);

  const onSend = useCallback(async () => {
    if (!threadId || !currentUserId || !text.trim()) return;
    try {
      setSending(true);
      await sendText(text.trim(), currentUserId);
      setText("");
      // refresh() ถูกเรียกใน hook แล้วหลังส่งสำเร็จ
    } catch (e: any) {
      // สามารถ showSnack/Alert ได้ตามที่คุณใช้ในโปรเจกต์
      console.warn("ส่งข้อความไม่สำเร็จ:", e?.message);
    } finally {
      setSending(false);
    }
  }, [threadId, currentUserId, text, sendText]);

  const onPickImage = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        console.warn("ไม่ได้รับสิทธิ์เข้าถึงคลังภาพ");
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        selectionLimit: 1,
      });
      if (res.canceled || !res.assets?.length || !currentUserId) return;
      setSending(true);
      await sendImageFromAsset(res.assets[0], currentUserId);
      // refresh() จะถูกเรียกใน hook
    } catch (e: any) {
      console.warn("อัปโหลดรูปไม่สำเร็จ:", e?.message);
    } finally {
      setSending(false);
    }
  }, [currentUserId, sendImageFromAsset]);

  const renderItem = useCallback(
    ({ item }: any) => {
      const mine = currentUserId && item.sender_id === currentUserId;
      return (
        <View style={[styles.row, mine ? styles.rowRight : styles.rowLeft]}>
          {!mine && (
            <View style={styles.avatar}>
              {otherAvatar ? (
                <Image source={{ uri: otherAvatar }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarImg, styles.avatarFallback]}>
                  <Ionicons name="person" size={16} />
                </View>
              )}
            </View>
          )}
          <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
            {item.text_body ? (
              <Text style={[styles.text, mine ? styles.textMine : styles.textOther]}>
                {item.text_body}
              </Text>
            ) : null}
            {item.image_url ? (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  // TODO: เปิดภาพเต็มหน้าจอ (Lightbox) ถ้าต้องการ
                }}
                style={{ marginTop: item.text_body ? 6 : 0 }}
              >
                <Image source={{ uri: item.image_url }} style={styles.image} />
              </TouchableOpacity>
            ) : null}
            <Text style={[styles.time, mine ? styles.timeMine : styles.timeOther]}>
              {formatTimeShort(item.created_at)}
            </Text>
          </View>
        </View>
      );
    },
    [currentUserId, otherAvatar]
  );

  const ListHeader = useMemo(
    () =>
      hasMore ? (
        <TouchableOpacity style={styles.loadMore} onPress={loadMore}>
          <Text style={styles.loadMoreText}>โหลดข้อความเก่า</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.topSpacer} />
      ),
    [hasMore, loadMore]
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, paddingTop: insets.top, paddingBottom: insets.bottom, backgroundColor: "#F6F7FB" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
    >
      <View style={{ flex: 1 }}>
        <FlatList
          ref={listRef}
          data={list}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8 }}
          ListHeaderComponent={ListHeader}
          ListFooterComponent={
            loading ? (
              <View style={{ paddingVertical: 8 }}>
                <ActivityIndicator />
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl refreshing={!!loading && list.length === 0} onRefresh={refresh} />
          }
          onContentSizeChange={() => {
            // เลื่อนไปล่างสุดหลังเปลี่ยนขนาด (ตอนข้อความใหม่เข้า)
            listRef.current?.scrollToEnd({ animated: true });
          }}
          onLayout={() => {
            // ตอนแรกเข้า — เลื่อนไปท้าย
            setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
          }}
        />
      </View>

      {/* กล่องพิมพ์ */}
      <View style={styles.composerWrap}>
        <TouchableOpacity style={styles.iconBtn} onPress={onPickImage} disabled={sending}>
          <Ionicons name="image" size={22} />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder="พิมพ์ข้อความ..."
          value={text}
          onChangeText={setText}
          multiline
        />

        <TouchableOpacity
          style={[styles.sendBtn, sending || !text.trim() ? styles.sendBtnDisabled : null]}
          onPress={onSend}
          disabled={sending || !text.trim()}
        >
          {sending ? <ActivityIndicator /> : <Ionicons name="send" size={18} color="#fff" />}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    marginVertical: 6,
    alignItems: "flex-end",
  },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },

  avatar: { marginRight: 8 },
  avatarImg: { width: 28, height: 28, borderRadius: 14 },
  avatarFallback: { alignItems: "center", justifyContent: "center", backgroundColor: "#E8E8E8" },

  bubble: {
    maxWidth: "78%",
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  bubbleOther: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#EEE",
  },
  bubbleMine: {
    backgroundColor: "#4F46E5",
  },

  text: { fontSize: 15, lineHeight: 21 },
  textOther: { color: "#1F2937" },
  textMine: { color: "#fff" },

  time: { marginTop: 4, fontSize: 11 },
  timeOther: { color: "#9CA3AF" },
  timeMine: { color: "rgba(255,255,255,0.8)" },

  image: { width: 220, height: 220, borderRadius: 12, backgroundColor: "#EEE" },

  loadMore: {
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "#E5E7EB",
    marginBottom: 6,
  },
  loadMoreText: { fontSize: 13, color: "#111827" },
  topSpacer: { height: 4 },

  composerWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    backgroundColor: "#FFF",
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    fontSize: 15,
  },
  sendBtn: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "#4F46E5",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#A5B4FC" },
});
