import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { getMessages, sendMessage, readMessage, ChatMessage } from "../../lib/chat_friend";
import { MessageItem } from "../../components/MessageItem";
import { Ionicons } from "@expo/vector-icons";
import { showSnack } from "../../components/Snackbar";

type params = {
  friendshipId: string;
  other_user_id: string;
  other_username: string;
  other_avatar: string;
};

export default function ChatScreen() {
  const nav = useNavigation();

  const { friendshipId, other_user_id, other_username, other_avatar } =
    useLocalSearchParams<params>();
  const friendship_id = Number(friendshipId);
  const OtherUserId = Number(other_user_id);
  const OtherUsername = String(other_username);
  const OtherAvatar = String(other_avatar);

  const [items, setItems] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const firstOpenRef = useRef(true);

  const [loading, setLoading] = useState(false);

  // ✅ ตั้ง Header
  useEffect(() => {
    nav.setOptions?.({
      title: OtherUsername || "แชท",
      headerRight: () =>
        OtherAvatar ? (
          <Image
            source={{ uri: OtherAvatar }}
            style={{ width: 32, height: 32, borderRadius: 15, marginLeft: 2 }}
          />
        ) : null,
    });
  }, [nav, OtherUsername, OtherAvatar]);

  // ใช้ ref เก็บ sinceId กัน interval รีสตาร์ท
  const sinceIdRef = useRef<number>(0);

  const mergeById = (prev: ChatMessage[], incoming: ChatMessage[]) => {
    if (!incoming?.length) return prev;
    const map = new Map<number, ChatMessage>();
    for (const m of prev) map.set(m.id, m);
    for (const m of incoming) map.set(m.id, m);
    return Array.from(map.values()).sort((a, b) => a.id - b.id);
  };

  const load = useCallback(async () => {
    try {
      const res = await getMessages(
        friendship_id,
        sinceIdRef.current || undefined,
        100
      );
      await readMessage(friendship_id, OtherUserId);
      if (res.items?.length) {
        setItems((prev) => mergeById(prev, res.items));
        // อัปเดต sinceId เป็น next หรืออย่างน้อย max id ที่ได้มา
        const maxIncoming = Math.max(...res.items.map((m) => m.id));
        sinceIdRef.current = Math.max(
          sinceIdRef.current || 0,
          res.next_since_id || 0,
          maxIncoming || 0
        );
      }
    } catch (e) {
      // เงียบได้ หรือ console.warn(e)
    }
  }, [friendship_id]);

  // โหลดครั้งแรก + โพลทุก 3 วิ (ไม่ผูกกับ sinceId)
  useEffect(() => {
    sinceIdRef.current = 0;
    setItems([]);
    load();
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(load, 3000);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [friendship_id, load]);

  const onSend = async () => {
    const msgTxt = text.trim();
    if (!msgTxt) return;
    try {
      // ส่งข้อความ
      setLoading(true);
      const msg = await sendMessage(friendship_id, msgTxt);
      setItems((prev) => mergeById(prev, [msg]));
      sinceIdRef.current = Math.max(sinceIdRef.current || 0, msg.id);
      setText("");
      // เลื่อนลงล่างหลังส่ง
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: true })
      );
    } catch (e: any) {
      showSnack({
        text: e?.message || "ส่งข้อความไม่สำเร็จ",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ เปิดหน้ามาครั้งแรก ให้เลื่อนลงล่างทันที
  useEffect(() => {
    if (items.length && firstOpenRef.current) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: false });
      });
      firstOpenRef.current = false;
    }
  }, [items.length]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(m) => String(m.id)}
          renderItem={({ item }) => <MessageItem m={item} />}
          contentContainerStyle={{
            paddingBottom: 16,
            paddingTop: 8,
            paddingHorizontal: 12,
          }}
          onContentSizeChange={() =>
            listRef.current?.scrollToEnd({ animated: true })
          }
          initialNumToRender={20}
          windowSize={10}
          removeClippedSubviews
        />

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 8,
            marginBottom: 42,
            marginHorizontal: 16,
          }}
        >
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="พิมพ์ข้อความ..."
            placeholderTextColor="#c5c5c5ff"
            style={{
              flex: 1,
              borderWidth: 1,
              borderColor: "#c5c5c5ff",
              padding: 12,
              borderRadius: 10,
              fontFamily: "KanitMedium",
            }}
            onSubmitEditing={onSend}
            returnKeyType="send"
          />
          <TouchableOpacity
            onPress={onSend}
            style={{
              marginLeft: 8,
              backgroundColor: "#2563EB",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 10,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Ionicons name="send" size={20} color="#fff" />
              )}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
