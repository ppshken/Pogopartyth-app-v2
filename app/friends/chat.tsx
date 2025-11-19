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
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import {
  getMessages,
  sendMessage,
  readMessage,
  ChatMessage,
} from "../../lib/chat_friend";
import { MessageItemFriend } from "../../components/MessageItemFriend";
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

  // จำนวนข้อความที่ “ดึงล่าสุด” (จะเพิ่มทีละ 5 เมื่อกดโหลดเพิ่มด้านบน)
  const [limit, setLimit] = useState(15);

  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false); // สถานะกดโหลดเพิ่ม
  const [showLoadMoreTop, setShowLoadMoreTop] = useState(false); // แสดงปุ่มเมื่อถึงบนสุด

  const [chat_total, setChatTotal] = useState(0);

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const firstOpenRef = useRef(true);

  // โพลลิ่งของใหม่
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const sinceIdRef = useRef<number>(0);

  // ตัวช่วยคุมสกอร์ล
  const isPrependingRef = useRef(false); // กำลังเติม “ด้านบน” อยู่ไหม
  const prevContentHeightRef = useRef(0); // ความสูง content ก่อนเติม
  const lastScrollYRef = useRef(0); // ตำแหน่ง Y ล่าสุด
  const shouldAutoScrollToEndRef = useRef(false); // ให้เลื่อนไปล่างเฉพาะกรณีมี “ของใหม่/เพิ่งส่ง”

  // ใช้ตัดสินว่า “ตอนนี้อยู่ใกล้ก้นลิสต์ไหม” (เพื่อ auto-scroll เฉพาะตอนอยู่ล่าง)
  const isNearBottomRef = useRef(true);

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

  const mergeById = (prev: ChatMessage[], incoming: ChatMessage[]) => {
    if (!incoming?.length) return prev;
    const map = new Map<number, ChatMessage>();
    for (const m of prev) map.set(m.id, m);
    for (const m of incoming) map.set(m.id, m);
    return Array.from(map.values()).sort((a, b) => a.id - b.id);
  };

  // โหลดข้อมูล (รองรับระบุ source + limitOverride)
  const load = useCallback(
    async (
      source: "init" | "poll" | "prepend" = "poll",
      limitOverride?: number
    ) => {
      try {
        const useLimit = limitOverride ?? limit;
        const res = await getMessages(
          friendship_id,
          sinceIdRef.current || undefined,
          useLimit
        );
        await readMessage(friendship_id, OtherUserId);
        setChatTotal(res.chat_all);

        if (res.items?.length) {
          setItems((prev) => mergeById(prev, res.items));
          // อัปเดต sinceId เป็น next หรืออย่างน้อย max id ที่ได้มา
          const maxIncoming = Math.max(...res.items.map((m) => m.id));
          sinceIdRef.current = Math.max(
            sinceIdRef.current || 0,
            res.next_since_id || 0,
            maxIncoming || 0
          );

          // เฉพาะ init/poll เท่านั้นที่อนุญาตให้เด้งลงล่างอัตโนมัติ
          if (source !== "prepend" && isNearBottomRef.current) {
            shouldAutoScrollToEndRef.current = true;
          }
        }
      } catch {
        // ignore
      }
    },
    [friendship_id, OtherUserId, limit]
  );

  // โหลดครั้งแรก + โพลทุก 3 วิ
  useEffect(() => {
    sinceIdRef.current = 0;
    setItems([]);
    shouldAutoScrollToEndRef.current = true; // ครั้งแรกให้เลื่อนไปล่าง
    load("init", limit);

    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => load("poll"), 5000);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [friendship_id, limit, load]);

  // ส่งข้อความ
  const onSend = async () => {
    const msgTxt = text.trim();
    if (!msgTxt) return;
    try {
      setLoadingSend(true);
      const msg = await sendMessage(friendship_id, msgTxt);
      setItems((prev) => mergeById(prev, [msg]));
      sinceIdRef.current = Math.max(sinceIdRef.current || 0, msg.id);
      setText("");
      // หลังส่งข้อความใหม่ → เลื่อนไปล่าง
      shouldAutoScrollToEndRef.current = true;
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: true })
      );
    } catch (e: any) {
      showSnack({
        text: e?.message || "ส่งข้อความไม่สำเร็จ",
        variant: "error",
      });
    } finally {
      setLoadingSend(false);
    }
  };

  // ✅ เปิดหน้ามาครั้งแรก ให้เลื่อนลงล่างทันที (ครั้งเดียว)
  useEffect(() => {
    if (items.length && firstOpenRef.current) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: false });
      });
      firstOpenRef.current = false;
    }
  }, [items.length]);

  // ⛳️ แสดงปุ่มโหลดเพิ่มเมื่อถึงบนสุดจริง ๆ
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;

    lastScrollYRef.current = contentOffset.y;

    // บนสุด?
    const atTop = contentOffset.y <= 12; // threshold เล็กน้อย
    setShowLoadMoreTop(atTop && !loadingOlder);

    // อยู่ใกล้ก้นลิสต์ไหม (ใช้ตัดสินว่าจะ auto-scroll เมื่อมีข้อความใหม่ไหม)
    const paddingToBottom = 48; // ยอมให้ห่างก้นลิสต์ได้นิดหน่อย
    isNearBottomRef.current =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;
  };

  // เมื่อ content เปลี่ยน (ทั้งตอนพรีเพนด์/ตอนมีของใหม่)
  const onContentSizeChange = (_w: number, h: number) => {
    if (isPrependingRef.current) {
      // ✅ เคสเติมด้านบน: คงตำแหน่งเดิมด้วย delta
      const delta = h - prevContentHeightRef.current;
      if (delta > 0) {
        requestAnimationFrame(() => {
          listRef.current?.scrollToOffset({
            offset: lastScrollYRef.current + delta,
            animated: false,
          });
        });
      }
      isPrependingRef.current = false;
      shouldAutoScrollToEndRef.current = false; // กันธงค้าง
    } else if (shouldAutoScrollToEndRef.current) {
      // ✅ เคสมีของใหม่/เพิ่งส่ง: เลื่อนไปล่าง (เฉพาะถ้าเราใกล้ก้นลิสต์ก่อนหน้า)
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
      shouldAutoScrollToEndRef.current = false;
    }
    // อัปเดตความสูงล่าสุด
    prevContentHeightRef.current = h;
  };

  // ▶️ กด “โหลดเพิ่มเติม” บนสุด → เพิ่ม limit แล้วดึงใหม่แบบ prepend
  const onPressLoadMoreTop = async () => {
    if (loadingOlder) return;
    setLoadingOlder(true);

    // ตั้งธง: เรากำลังพรีเพนด์ ห้ามเด้งลงล่าง
    isPrependingRef.current = true;
    shouldAutoScrollToEndRef.current = false;

    const newLimit = limit + 5;
    setLimit(newLimit); // อัปเดต state (ไม่ต้องรอ)
    await load("prepend", newLimit);

    setLoadingOlder(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
        {showLoadMoreTop && items.length < chat_total ? (
          <View
            style={{
              padding: 10,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <TouchableOpacity
              onPress={onPressLoadMoreTop}
              activeOpacity={0.8}
              style={{
                backgroundColor: "#FFFFFF",
                borderColor: "#E5E7EB",
                borderWidth: 1,
                paddingVertical: 8,
                paddingHorizontal: 12,
                borderRadius: 8,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }}
            >
              {loadingOlder ? (
                <ActivityIndicator />
              ) : (
                <Ionicons
                  name="arrow-up-circle-outline"
                  size={18}
                  color="#111827"
                />
              )}
              <Text style={{ fontFamily: "KanitSemiBold", color: "#111827" }}>
                โหลดข้อความเก่า
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(m) => String(m.id)}
          renderItem={({ item }) => <MessageItemFriend m={item} />}
          contentContainerStyle={{
            paddingBottom: 16,
            paddingTop: 8,
            paddingHorizontal: 12,
          }}
          onScroll={onScroll}
          onContentSizeChange={onContentSizeChange}
          scrollEventThrottle={16}
          initialNumToRender={20}
          windowSize={10}
          removeClippedSubviews
        />

        {/* แถบป้อนข้อความ */}
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
              {loadingSend ? (
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
