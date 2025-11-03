// app/(tabs)/settings/user-log.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/lib/api";
import { showSnack } from "@/components/Snackbar";
import { getProfile, getUserLog } from "@/lib/user"; // คาดว่ามีในโปรเจกต์

const ACCENT = "#111827";
const BORDER = "#E5E7EB";
const TEXT_MAIN = "#111827";
const TEXT_SUB = "#9CA3AF";
const CARD_BG = "#FFFFFF";
const ERROR = "#DC2626";

type LogItem = {
  id: number;
  room_id: number | null;
  user_id: number;
  type: "join" | "leave" | "review" | string;
  description: string;
  created_at: string; // "YYYY-MM-DD HH:mm:ss"
  username: string | null;
  avatar: string | null;
  pokemon_image: string;
};

type ApiPayload = {
  list: LogItem[];
  pagination: {
    page: number;
    has_more: boolean;
  };
};

function parseDate(s: string) {
  // รองรับ "YYYY-MM-DD HH:mm:ss"
  if (!s) return new Date(NaN);
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date(s) : d;
}

function timeAgo(thaiDate: string) {
  const d = parseDate(thaiDate);
  const now = new Date();
  const diff = Math.max(0, now.getTime() - d.getTime());
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec} วินาทีที่แล้ว`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} นาทีที่แล้ว`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ชั่วโมงที่แล้ว`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} วันที่แล้ว`;
  return d.toLocaleString(); // แสดงเต็มๆ ถ้าเกิน 7 วัน
}

export default function UserLogScreen() {
  const router = useRouter();

  const [userId, setUserId] = useState<number | null>(null);
  const [items, setItems] = useState<LogItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const [loading, setLoading] = useState(false); // โหลดหน้าแรก/โหลดเพิ่ม
  const [refreshing, setRefreshing] = useState(false); // ดึงซ้ำ
  const [error, setError] = useState<string | null>(null);

  const loadProfileUser = useCallback(async () => {
    const me = (await getProfile()) as { id: number };
    setUserId(me.id);
    return me.id;
  }, []);

  const fetchPage = useCallback(
    async (p: number, uid?: number) => {
      const targetUserId = uid ?? userId;
      if (!targetUserId) return;
      const res = await api.get("/api/raid/log/my_list.php", {
        params: { user_id: targetUserId, page: p },
        validateStatus: () => true,
      });
      if (!res.data?.success) {
        throw new Error(res.data?.message || "โหลดประวัติไม่สำเร็จ");
      }
      const data: ApiPayload = res.data.data;
      return data;
    },
    [userId]
  );

  const initialLoad = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const uid = await loadProfileUser();
      const data = await fetchPage(1, uid);
      setItems(data?.list ?? []);
      setPage(1);
      setHasMore(!!data?.pagination?.has_more);
    } catch (e: any) {
      const msg = e?.message || "โหลดประวัติไม่สำเร็จ";
      setError(msg);
      showSnack({ text: msg, variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [fetchPage, loadProfileUser]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchPage(1);
      setItems(data?.list ?? []);
      setPage(1);
      setHasMore(!!data?.pagination?.has_more);
    } catch (e: any) {
      showSnack({ text: e?.message || "รีเฟรชไม่สำเร็จ", variant: "error" });
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage]);

  const onEndReached = useCallback(async () => {
    if (loading || refreshing || !hasMore) return;
    setLoading(true);
    try {
      const next = page + 1;
      const data = await fetchPage(next);
      const more = data?.list ?? [];
      setItems((prev) => [...prev, ...more]);
      setPage(next);
      setHasMore(!!data?.pagination?.has_more);
    } catch (e: any) {
      showSnack({ text: e?.message || "โหลดเพิ่มไม่สำเร็จ", variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [fetchPage, hasMore, loading, page, refreshing]);

  useEffect(() => {
    initialLoad();
  }, [initialLoad]);

  const renderItem = useCallback(
    ({ item }: { item: LogItem }) => {
      const avatarSrc = item.pokemon_image;
      const desc = item.description || item.type;
      const ago = timeAgo(item.created_at);
      const canOpenRoom = !!item.room_id && item.room_id > 0;

      const type_color =
        item.type === "create"
          ? "#5ad88fff"
          : item.type === "join"
          ? "#ecac59ff"
          : item.type === "invite"
          ? "#6d99ebff"
          : item.type === "leave"
          ? "#df5ae4ff"
          : item.type === "cancel"
          ? "#e2555cff"
          : item.type === "review"
          ? "#e0ae50ff"
          : "#000000";

      return (
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.row}
          onPress={() => {
            if (canOpenRoom) {
              router.push(`/rooms/${item.room_id}`);
            }
          }}
        >
          <Image source={{ uri: avatarSrc }} style={styles.avatar} />
          <View style={{ flex: 1 }}>
            <View style={styles.rowTop}>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View
                  style={[styles.typeBadge, { backgroundColor: type_color }]}
                >
                  <Text style={styles.typeText}>{item.type}</Text>
                </View>
                <Text style={styles.descText}>#{item.room_id}</Text>
              </View>
              <Text style={styles.timeText}>{ago}</Text>
            </View>
            <Text style={styles.descText} numberOfLines={2}>
              {desc}
            </Text>
          </View>
        </TouchableOpacity>
      );
    },
    [router]
  );

  const keyExtractor = useCallback((it: LogItem) => String(it.id), []);

  const listEmpty = useMemo(
    () => (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyText}>ยังไม่มีประวัติการใช้งาน</Text>
      </View>
    ),
    []
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>
          ประวัติการใช้งาน {items.length > 0 ? `(${items.length})` : null}
        </Text>
        <Text style={styles.subtitle}>การเข้าร่วมห้อง ออกจากห้อง และรีวิว</Text>
      </View>

      {error ? (
        <View style={styles.errorWrap}>
          <Ionicons name="warning-outline" size={20} color={ERROR} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        contentContainerStyle={[
          styles.listContent,
          items.length === 0 ? { flexGrow: 1 } : null,
        ]}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        onEndReachedThreshold={0.35}
        onEndReached={onEndReached}
        ListEmptyComponent={!loading ? listEmpty : null}
        ListFooterComponent={
          loading && items.length > 0 ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator />
              <Text style={styles.footerText}>กำลังโหลด...</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  title: {
    fontSize: 20,
    color: TEXT_MAIN,
    fontFamily: "KanitSemiBold",
  },
  subtitle: {
    marginTop: 2,
    color: TEXT_SUB,
    fontSize: 13,
    fontFamily: "KanitRegular",
  },

  listContent: {
    padding: 16,
  },
  row: {
    backgroundColor: CARD_BG,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    flexDirection: "row",
    gap: 12,
  },
  avatar: { width: 50, height: 50, borderRadius: 10, backgroundColor: "#eee" },

  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
  },
  typeText: { color: "#ffffff", fontSize: 12, fontFamily: "KanitMedium" },

  timeText: { color: TEXT_SUB, fontSize: 12, fontFamily: "KanitRegular" },
  descText: { color: TEXT_MAIN, fontSize: 14, fontFamily: "KanitMedium" },

  roomPill: {
    marginTop: 8,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#EEF2FF",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: "#E0E7FF",
  },
  roomPillText: {
    color: ACCENT,
    fontSize: 12,
    fontFamily: "KanitSemiBold",
  },

  sep: { height: 10 },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 8,
    color: TEXT_SUB,
    fontFamily: "KanitSemiBold",
  },

  errorWrap: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: { color: ERROR, fontFamily: "KanitRegular" },

  footerLoading: {
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  footerText: { color: TEXT_SUB, fontFamily: "KanitRegular", fontSize: 12 },
});
