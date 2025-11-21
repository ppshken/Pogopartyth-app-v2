// app/screens/chat.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  AppState,
} from "react-native";
import { useIsFocused, useNavigation } from "@react-navigation/native";
import { useLocalSearchParams, router } from "expo-router";
import {
  getMessages,
  sendMessage,
  readMessage,
  ChatMessage,
} from "../../lib/chat_friend";
import { MessageItemFriend } from "../../components/MessageItemFriend";
import { Ionicons } from "@expo/vector-icons";
import { showSnack } from "../../components/Snackbar";

type Params = {
  friendshipId: string;
  other_user_id: string;
  other_username: string;
  other_avatar: string;
};

type ListRow =
  | { type: "date"; id: string; date: string }
  | ({ type: "msg"; id: number } & ChatMessage);

export default function ChatScreen() {
  const nav = useNavigation();
  const isFocused = useIsFocused();
  const { friendshipId, other_user_id, other_username, other_avatar } =
    useLocalSearchParams<Params>();
  const friendship_id = Number(friendshipId);
  const OtherUserId = Number(other_user_id);
  const OtherUsername = String(other_username || "แชท");
  const OtherAvatar = String(other_avatar || "");

  const [items, setItems] = useState<ChatMessage[]>([]);
  const [listRows, setListRows] = useState<ListRow[]>([]);
  const [text, setText] = useState("");

  // กำหนดลิมิตเริ่มต้นเป็น 20 แถว ตามที่ต้องการ
  const [limit, setLimit] = useState(20);

  const [loadingSend, setLoadingSend] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false); // สถานะโหลดข้อมูลเก่า
  const [chat_total, setChatTotal] = useState(0);

  const listRef = useRef<FlatList<ListRow>>(null);

  // ตัวแปรสำหรับ Polling และ Cursor
  const timerRef = useRef<number | null>(null);
  const sinceIdRef = useRef<number>(0);
  const oldestIdRef = useRef<number | null>(null); // เก็บ ID ที่เก่าที่สุดที่โหลดมาแล้ว

  // ตัวช่วยจัดการตำแหน่ง Scroll (เมื่อโหลดข้อมูลเก่าเพิ่ม)
  const isPrependingRef = useRef(false);
  const prevContentHeightRef = useRef(0);
  const lastScrollYRef = useRef(0);

  // App state
  const appStateRef = useRef(AppState.currentState);

  // ตั้งค่า Header
  useEffect(() => {
    nav.setOptions?.({
      title: OtherUsername,
      headerRight: () =>
        OtherAvatar ? (
          <TouchableOpacity onPress={() => setUserMenuVisible((p) => !p)}>
            <Image
              source={{ uri: OtherAvatar }}
              style={{ width: 32, height: 32, borderRadius: 16, marginLeft: 2 }}
            />
          </TouchableOpacity>
        ) : null,
    });
  }, [nav, OtherUsername, OtherAvatar]);

  const [userMenuVisible, setUserMenuVisible] = useState(false);

  // สร้างรายการแสดงผล (แทรกวันที่)
  const buildRowsFromItems = useCallback((msgs: ChatMessage[]): ListRow[] => {
    const out: ListRow[] = [];
    let prevDate: string | null = null;
    for (const m of msgs) {
      const d = m.created_at ? m.created_at.slice(0, 10) : "";
      if (d !== prevDate) {
        out.push({ type: "date", id: `date-${d}`, date: d });
        prevDate = d;
      }
      out.push({ type: "msg", ...m });
    }
    return out;
  }, []);

  // รวมข้อความใหม่เข้ากับข้อความเดิม (กันซ้ำด้วย ID)
  const mergeById = useCallback(
    (prev: ChatMessage[], incoming: ChatMessage[]) => {
      if (!incoming?.length) return prev;
      const map = new Map<number, ChatMessage>();
      for (const m of prev) map.set(m.id, m);
      for (const m of incoming) map.set(m.id, m);
      return Array.from(map.values()).sort((a, b) => a.id - b.id);
    },
    []
  );

  // ใน load function
  const load = useCallback(
    async (opts?: {
      source?: "init" | "poll" | "prepend";
      beforeId?: number;
      sinceId?: number;
      limit?: number;
    }) => {
      const source = opts?.source ?? "poll";
      const useLimit = opts?.limit ?? limit;

      try {
        const before = opts?.beforeId;

        // *** แก้ไขจุดนี้ ***
        // ถ้ามี before (โหลดเก่า) ให้ since เป็น undefined
        // ถ้าไม่มี before (โหลดใหม่/poll) ให้ใช้ค่าจาก ref หรือ opts
        const since = before
          ? undefined
          : opts?.sinceId ??
            (sinceIdRef.current > 0 ? sinceIdRef.current : undefined);

        // เรียก API
        const res = await getMessages(friendship_id, since, useLimit, before);

        // อ่านข้อความฝั่งตรงข้ามเสมอเมื่อโหลด
        await readMessage(friendship_id, OtherUserId);

        // ... (โค้ดส่วน mark read เหมือนเดิม) ...

        setChatTotal(res.chat_all ?? 0);

        const incoming: ChatMessage[] = res.items ?? [];

        if (incoming.length > 0) {
          setItems((prev) => {
            const next = mergeById(prev, incoming);

            // อัปเดต sinceId (สำหรับ polling ของใหม่)
            const maxIncoming = Math.max(...incoming.map((m) => m.id));
            sinceIdRef.current = Math.max(
              sinceIdRef.current || 0,
              res.next_since_id || 0,
              maxIncoming || 0
            );

            return next;
          });

          // *** แก้ไขการอัปเดต oldestIdRef ***
          // หาค่า ID ที่น้อยที่สุดจาก incoming เพื่อใช้เป็นจุดโหลดครั้งถัดไป
          const minIncoming = Math.min(...incoming.map((m) => m.id));

          // อัปเดตถ้ายังไม่มีค่า หรือถ้าค่าใหม่น้อยกว่าค่าเดิม
          if (
            oldestIdRef.current === null ||
            minIncoming < oldestIdRef.current
          ) {
            oldestIdRef.current = minIncoming;
          }

          // ถ้าไม่ใช่การโหลดเก่า ให้เลื่อนลงล่าง
          if (source !== "prepend") {
            setTimeout(() => {
              listRef.current?.scrollToEnd({
                animated: source === "init" ? false : true,
              });
            }, 200);
          }
        }

        // Backup: ถ้า API ส่ง oldest_id มาโดยตรงให้ใช้ค่าจาก API
        if (typeof res.oldest_id !== "undefined" && res.oldest_id !== null) {
          oldestIdRef.current = res.oldest_id;
        }
      } catch (e: any) {
        console.log("Load error", e);
      }
    },
    [friendship_id, OtherUserId, limit, mergeById]
  );

  // โหลดครั้งแรก
  useEffect(() => {
    sinceIdRef.current = 0;
    oldestIdRef.current = null;
    setItems([]);
    setListRows([]);
    // เริ่มต้นโหลด 20 แถว และกำหนด source เป็น init เพื่อให้ scroll ลงล่าง
    load({ source: "init", limit: 20 });

    // ตั้งเวลา Polling
    if (timerRef.current) clearInterval(timerRef.current);
    if (isFocused && appStateRef.current === "active") {
      timerRef.current = setInterval(() => {
        if (appStateRef.current !== "active" || !isFocused) return;
        load({ source: "poll", sinceId: sinceIdRef.current, limit: 50 });
      }, 5000) as unknown as number;
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [friendship_id, isFocused, load]);

  // จัดการ Polling ตาม AppState
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      appStateRef.current = next;
      if (next !== "active") {
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        if (isFocused && !timerRef.current) {
          timerRef.current = setInterval(() => {
            if (appStateRef.current !== "active" || !isFocused) return;
            load({ source: "poll", sinceId: sinceIdRef.current, limit: 50 });
          }, 5000) as unknown as number;
        }
      }
    });
    return () => sub.remove();
  }, [isFocused, load]);

  // แปลง Items เป็น Rows ทุกครั้งที่ข้อมูลเปลี่ยน
  useEffect(() => {
    const rows = buildRowsFromItems(items);
    setListRows(rows);
  }, [items, buildRowsFromItems]);

  // ฟังก์ชันส่งข้อความ
  const onSend = useCallback(async () => {
    const msgTxt = text.trim();
    if (!msgTxt || loadingSend) return;
    setLoadingSend(true);
    try {
      const msg = await sendMessage(friendship_id, msgTxt);
      setItems((prev) => {
        const next = mergeById(prev, [msg]);
        sinceIdRef.current = Math.max(sinceIdRef.current || 0, msg.id);
        return next;
      });
      setText("");
      // ส่งเสร็จเลื่อนลงล่างสุด
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
    } catch (e: any) {
      showSnack({
        text: e?.message || "ส่งข้อความไม่สำเร็จ",
        variant: "error",
      });
    } finally {
      setLoadingSend(false);
    }
  }, [text, loadingSend, friendship_id, mergeById]);

  // ฟังก์ชันโหลดข้อมูลเก่าเพิ่มเมื่อกดปุ่ม
  const loadOlder = useCallback(async () => {
    if (loadingOlder) return;
    // เช็คว่ามี ID อ้างอิงหรือไม่
    if (!oldestIdRef.current) return;

    setLoadingOlder(true);
    isPrependingRef.current = true; // บอกระบบว่ากำลังแทรกข้างบน

    try {
      // โหลดเพิ่มทีละ 20 แถว (ใช้ beforeId คือตัวเก่าสุดที่มีปัจจุบัน)
      await load({
        source: "prepend",
        beforeId: oldestIdRef.current,
        limit: 20,
      });
    } finally {
      setLoadingOlder(false);
    }
  }, [loadingOlder, load]);

  // จัดการตำแหน่ง Scroll เมื่อมีการแทรกข้อมูลด้านบน (สำหรับ Android/General)
  const onContentSizeChange = useCallback((w: number, h: number) => {
    if (isPrependingRef.current) {
      const delta = h - prevContentHeightRef.current;
      if (delta > 0) {
        // ปรับตำแหน่ง Scroll ลงมาชดเชยความสูงที่เพิ่มขึ้น เพื่อให้ดูเหมือนอยู่ที่เดิม
        listRef.current?.scrollToOffset({
          offset: lastScrollYRef.current + delta,
          animated: false,
        });
      }
      isPrependingRef.current = false;
    }
    prevContentHeightRef.current = h;
  }, []);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    lastScrollYRef.current = e.nativeEvent.contentOffset.y;
  }, []);

  // ส่วนหัวของ List (ปุ่มโหลดเพิ่มเติม)
  const renderHeader = useMemo(() => {
    // ถ้าไม่มีรายการ หรือ จำนวนรายการทั้งหมดเท่ากับที่มีอยู่แล้ว ไม่ต้องโชว์ปุ่ม
    // (logic นี้อาจต้องปรับตาม API response ของคุณว่าบอก total มาแม่นยำแค่ไหน)
    if (listRows.length === 0) return null;
    if (listRows.filter((r) => r.type === "msg").length >= chat_total) {
      return null;
    }
    return (
      <View style={{ paddingVertical: 10, alignItems: "center" }}>
        {loadingOlder ? (
          <ActivityIndicator size="small" color="#2563EB" />
        ) : (
          <TouchableOpacity
            onPress={loadOlder}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: "#E5E7EB",
              borderRadius: 16,
            }}
          >
            <Text
              style={{
                fontFamily: "KanitMedium",
                fontSize: 12,
                color: "#4B5563",
              }}
            >
              โหลดข้อความเพิ่มเติม
            </Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }, [loadingOlder, loadOlder, listRows.length]);

  const renderRow = useCallback(({ item }: { item: ListRow }) => {
    if (item.type === "date") {
      const display = (() => {
        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 86400000)
          .toISOString()
          .slice(0, 10);

        if (item.date === today) return "วันนี้";
        if (item.date === yesterday) return "เมื่อวาน";

        // --- แก้ไขตรงนี้ ---
        // item.date ค่าเดิมคือ "2025-11-21" (ปี-เดือน-วัน)
        const [year, month, day] = item.date.split("-");

        // คืนค่าเป็น "21-11-2025" (วัน-เดือน-ปี)
        return `${day}-${month}-${year}`;

        // หมายเหตุ: ถ้าอยากได้เป็น พ.ศ. ให้ใช้บรรทัดนี้แทน:
        // return `${day}-${month}-${parseInt(year) + 543}`;
      })();

      return (
        <View
          style={{ width: "100%", alignItems: "center", marginVertical: 8 }}
        >
          <View
            style={{
              backgroundColor: "#FFFFFF",
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: "#E5E7EB",
              shadowColor: "#000",
              shadowOpacity: 0.03,
              elevation: 1,
            }}
          >
            <Text
              style={{
                fontFamily: "KanitSemiBold",
                fontSize: 12,
                color: "#374151",
              }}
            >
              {display}
            </Text>
          </View>
        </View>
      );
    } else {
      return <MessageItemFriend m={item} />;
    }
  }, []);

  const keyExtractor = useCallback((r: ListRow) => String(r.id), []);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={80}
    >
      <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
        <FlatList
          ref={listRef}
          data={listRows}
          keyExtractor={keyExtractor}
          renderItem={renderRow}
          // ใส่ Header เป็นปุ่มโหลดเพิ่มเติม
          ListHeaderComponent={renderHeader}
          ListFooterComponent={
            !listRows ? (
              <View style={{ paddingVertical: 12, alignItems: "center" }}>
                <ActivityIndicator size="large" />
              </View>
            ) : null
          }
          contentContainerStyle={{
            paddingBottom: 16,
            paddingTop: 8,
            paddingHorizontal: 12,
            // เพิ่ม space เล็กน้อยเผื่อคีย์บอร์ดบัง
          }}
          // ลบ onScroll ที่ใช้ Auto-load ออก เหลือแค่เก็บค่า Y
          onScroll={onScroll}
          // Logic การคงตำแหน่ง Scroll
          onContentSizeChange={onContentSizeChange}
          // สำหรับ iOS: ช่วยให้ Scroll ไม่กระโดดเมื่อเพิ่มของด้านบน
          maintainVisibleContentPosition={{
            minIndexForVisible: 0,
          }}
          scrollEventThrottle={16}
          initialNumToRender={20}
          windowSize={9}
          removeClippedSubviews={true}
        />

        {/* Input Area (เหมือนเดิม) */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 8,
            marginBottom: Platform.OS === "ios" ? 42 : 16,
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

      {/* User Menu (เหมือนเดิม) */}
      {userMenuVisible ? (
        <View
          style={{
            backgroundColor: "#ffffffff",
            width: 220,
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
