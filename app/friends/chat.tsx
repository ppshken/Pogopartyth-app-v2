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
import { router, useLocalSearchParams, useNavigation } from "expo-router";
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

  const [limit, setLimit] = useState(40);
  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [showLoadMoreTop, setShowLoadMoreTop] = useState(false);
  const [userMenu, setUserMenu] = useState(false);
  const [chat_total, setChatTotal] = useState(0);

  const listRef = useRef<FlatList<ChatMessage>>(null);
  const firstOpenRef = useRef(true);

  // polling timer (React Native uses number)
  const timer = useRef<number | null>(null);
  const sinceIdRef = useRef<number>(0);

  // scroll helpers
  const isPrependingRef = useRef(false);
  const prevContentHeightRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const shouldAutoScrollToEndRef = useRef(false);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    nav.setOptions?.({
      title: OtherUsername || "แชท",
      headerRight: () =>
        OtherAvatar ? (
          <TouchableOpacity
            onPress={() => {
              setUserMenu((prev) => !prev);
            }}
          >
            <Image
              source={{ uri: OtherAvatar }}
              style={{ width: 32, height: 32, borderRadius: 15, marginLeft: 2 }}
            />
          </TouchableOpacity>
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

  const load = useCallback(
    async (
      source: "init" | "poll" | "prepend" = "poll",
      limitOverride?: number
    ) => {
      try {
        const useLimit = limitOverride ?? limit;
        // ส่ง since id เฉพาะเมื่อมีค่ามากกว่า 0
        const since = sinceIdRef.current > 0 ? sinceIdRef.current : undefined;
        const res = await getMessages(friendship_id, since, useLimit);
        await readMessage(friendship_id, OtherUserId);
        setChatTotal(res.chat_all);

        if (res.items?.length) {
          setItems((prev) => mergeById(prev, res.items));
          const maxIncoming = Math.max(...res.items.map((m) => m.id));
          sinceIdRef.current = Math.max(
            sinceIdRef.current || 0,
            res.next_since_id || 0,
            maxIncoming || 0
          );

          if (source !== "prepend" && isNearBottomRef.current) {
            shouldAutoScrollToEndRef.current = true;
          }
        }
      } catch (err) {
        // ถ้าต้องการแสดง error ให้ทำที่นี่
      }
    },
    [friendship_id, OtherUserId, limit]
  );

  useEffect(() => {
    sinceIdRef.current = 0;
    setItems([]);
    shouldAutoScrollToEndRef.current = true;
    load("init", limit);

    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    // poll ทุก 5 วิ (ถ้าต้องการเร็วขึ้น เปลี่ยนเป็น 3000)
    timer.current = setInterval(() => {
      load("poll");
    }, 5000) as unknown as number;

    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
  }, [friendship_id, limit, load]);

  const onSend = async () => {
    const msgTxt = text.trim();
    if (!msgTxt || loadingSend) return; // ป้องกันส่งซ้ำ
    try {
      setLoadingSend(true);
      const msg = await sendMessage(friendship_id, msgTxt);
      setItems((prev) => mergeById(prev, [msg]));
      sinceIdRef.current = Math.max(sinceIdRef.current || 0, msg.id);
      setText("");
      // ตั้งธงให้ onContentSizeChange เลื่อนไปสุดเมื่อ content มา
      shouldAutoScrollToEndRef.current = true;
      // **ไม่เรียก scrollToEnd ตรงนี้** — รอ onContentSizeChange จะปลอดภัยกว่า
    } catch (e: any) {
      showSnack({
        text: e?.message || "ส่งข้อความไม่สำเร็จ",
        variant: "error",
      });
    } finally {
      setLoadingSend(false);
    }
  };

  useEffect(() => {
    if (items.length && firstOpenRef.current) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: false });
      });
      firstOpenRef.current = false;
    }
  }, [items.length]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    lastScrollYRef.current = contentOffset.y;
    const atTop = contentOffset.y <= 12;
    setShowLoadMoreTop(atTop && !loadingOlder && items.length < chat_total);

    const paddingToBottom = 48;
    isNearBottomRef.current =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;
  };

  const onContentSizeChange = (_w: number, h: number) => {
    if (isPrependingRef.current) {
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
      shouldAutoScrollToEndRef.current = false;
    } else if (shouldAutoScrollToEndRef.current) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
      shouldAutoScrollToEndRef.current = false;
    }
    prevContentHeightRef.current = h;
  };

  const onPressLoadMoreTop = async () => {
    if (loadingOlder) return;
    setLoadingOlder(true);
    isPrependingRef.current = true;
    shouldAutoScrollToEndRef.current = false;

    const newLimit = limit + 5;
    setLimit(newLimit);
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
            editable={!loadingSend}
          />
          <TouchableOpacity
            onPress={onSend}
            disabled={loadingSend}
            style={{
              marginLeft: 8,
              backgroundColor: loadingSend ? "#9DBBF9" : "#2563EB",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 10,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {loadingSend ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Ionicons name="send" size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Dropdown User Menu */}
      {userMenu ? (
        <View
          style={{
            backgroundColor: "#ffffffff",
            width: 220,
            height: "auto",
            position: "absolute",
            top: 2,
            right: 11,
            borderRadius: 12,
            padding: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
          }}
        >
          <TouchableOpacity
            style={{
              padding: 12,
              backgroundColor: "#f5f5f5ff",
              borderRadius: 8,
              marginBottom: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
            onPress={() => router.push("/friends/" + OtherUserId)}
          >
            <Ionicons name="person" size={20} color="#111827" />
            <Text style={{ fontFamily: "KanitSemiBold" }}>ดูโปรไฟล์</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={{
              padding: 12,
              backgroundColor: "#f5f5f5ff",
              borderRadius: 8,
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Ionicons name="information" size={20} color="#111827" />
            <Text style={{ fontFamily: "KanitSemiBold" }}>รายงาน</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}
