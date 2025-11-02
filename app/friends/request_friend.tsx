// app/(tabs)/friends/Request_friend.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { GetPendingFriends, AcceptFriend, DeclineFriend } from "@/lib/friend";
import { showSnack } from "../../components/Snackbar";
import { router } from "expo-router";
import { minutesAgoTH } from "../../hooks/useTimeAgoTH";

type PendingItem = {
  request_id: number;
  requester_id: number;
  username: string;
  avatar?: string | null;
  team?: string | null;
  level?: number | null;
  friend_code?: string | null;
  created_at?: string;
  status?: string;
};

const PAGE_SIZE = 20;

export default function RequestFriend() {
  const [items, setItems] = useState<PendingItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingAccept, setLoadingAccept] = useState(false);
  const [loadingDeclin, setLoadingDeclin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [onModal, setOnmodal] = useState(false);
  const [selected, setSelected] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p = 1, append = false) => {
    try {
      if (!append) setLoading(true);
      setError(null);
      const res = await GetPendingFriends({
        page: p,
        limit: PAGE_SIZE,
      });
      setHasMore(!!res.pagination?.has_more);
      setPage(res.pagination?.page || p);
      setItems((prev) => (append ? [...prev, ...res.list] : res.list));
    } catch (e: any) {
      setError(e?.message || "โหลดรายการไม่สำเร็จ");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(1, false);
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(1, false);
  };
  const loadMore = () => {
    if (!loading && hasMore) load(page + 1, true);
  };

  // รับเพื่อน
  const accept = async (requester_id: number) => {
    setLoadingAccept(true);
    try {
      await AcceptFriend(requester_id);
      showSnack({ text: "รับเพื่อนแล้วเรียบร้อย", variant: "success" });
      setOnmodal(false);
      setLoadingAccept(false);
      load();
    } catch (e: any) {
      showSnack({
        text: e?.message || "รับเพื่อนล้มเหลว",
        variant: "error",
      });
    } finally {
      setLoadingAccept(false);
      setOnmodal(false);
    }
  };

  // ปฏิเสธ
  const declin = async (requester_id: number) => {
    setLoadingDeclin(true);
    try {
      await DeclineFriend(requester_id);
      showSnack({ text: "ปฏิเสธเพื่อนแล้วเรียบร้อย", variant: "success" });
      setLoadingDeclin(false);
      load();
    } catch (e: any) {
      showSnack({
        text: e?.message || "ปฏิเสธล้มเหลว",
        variant: "error",
      });
    } finally {
      setLoadingDeclin(false);
    }
  };

  const formatCode = (code?: string | null) =>
    code
      ? code
          .replace(/\s+/g, "")
          .replace(/(.{4})/g, "$1 ")
          .trim()
      : "-";

  const Row = ({ item }: { item: PendingItem }) => {
    const teamColors: Record<string, string> = {
      Mystic: "#3B82F6", // น้ำเงิน
      Valor: "#EF4444", // แดง
      Instinct: "#FBBF24", // เหลือง
    };

    return (
      <View style={s.card}>
        <TouchableOpacity
          onPress={() => router.push(`/friends/${item.requester_id}`)}
        >
          <Image
            source={{
              uri:
                item.avatar ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                  item.username
                )}`,
            }}
            style={s.avatar}
          />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <View
              style={{
                flexDirection: "row",
                gap: 8,
                alignItems: "center",
              }}
            >
              <Text style={s.username} numberOfLines={1}>
                {item.username}
              </Text>
              <View
                style={[
                  s.team,
                  { backgroundColor: teamColors[item.team ?? ""] },
                ]}
              >
                <Text style={s.metalevel}>Level {item.level}</Text>
              </View>
            </View>
            <Text style={s.timeago}>
              {minutesAgoTH(item.created_at as string)}
            </Text>
          </View>

          <Text style={s.meta}>
            Friend code - {formatCode(item.friend_code)}
          </Text>

          <View style={s.actions}>
            <TouchableOpacity
              style={[s.btn, s.primary]}
              onPress={() => {
                setSelected(item.requester_id);
                setOnmodal(true);
              }}
            >
              <Ionicons name="checkmark" size={16} color="#fff" />
              <Text style={s.primaryText}>ยอมรับ</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[s.btn, s.ghost]}
              onPress={() => declin(item.requester_id)}
            >
              {loadingDeclin ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons name="close" size={16} color="#111827" />
                  <Text style={s.ghostText}>ปฏิเสธ</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={s.container}>
      {error && (
        <TouchableOpacity style={s.errorBox} onPress={() => load(1, false)}>
          <Ionicons name="warning-outline" size={16} color="#991B1B" />
          <Text style={s.errorText}>{error} — แตะเพื่อลองใหม่</Text>
        </TouchableOpacity>
      )}
      <View style={{ marginLeft: 14, marginTop: 14, marginBottom: 14 }}>
        <Text style={{ fontFamily: "KanitSemiBold" }}>
          คำขอเป็นเพื่อน ({items.length})
        </Text>
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => String(it.request_id)}
        renderItem={Row}
        ListEmptyComponent={
          !loading ? (
            <View>
              <Text style={{ fontFamily: "KanitRegular" }}>
                ยังไม่มีคำขอเป็นเพื่อน
              </Text>
            </View>
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 24 }}
        onEndReachedThreshold={0.2}
        onEndReached={loadMore}
        ListFooterComponent={
          loading && items.length > 0 ? (
            <View style={{ paddingVertical: 12, alignItems: "center" }}>
              <ActivityIndicator />
            </View>
          ) : null
        }
      />

      {/* Modal: ยืนยันการรับเพื่อน */}
      <Modal
        visible={onModal}
        transparent
        animationType="fade"
        onRequestClose={() => setOnmodal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>ยืนยันการรับเพื่อน ?</Text>
            <TouchableOpacity
              onPress={() => {
                accept(selected);
              }}
              style={[s.modalBtn, { backgroundColor: "#3B82F6" }]}
            >
              {loadingAccept ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={s.modalBtnText}>ยืนยัน</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setOnmodal(false)}
              style={[s.modalBtn, s.modalCancel]}
            >
              <Text style={[s.modalBtnText, { color: "#111827" }]}>ยกเลิก</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    margin: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    height: 44,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    marginHorizontal: 12,
    borderRadius: 10,
    padding: 10,
  },
  errorText: { marginLeft: 8, color: "#991B1B", fontSize: 13 },
  card: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E5E7EB",
  },
  username: { fontFamily: "KanitSemiBold", fontSize: 16, color: "#111827" },
  timeago: { fontFamily: "KanitMedium", fontSize: 12, color: "#56595eff" },
  team: {
    padding: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  metalevel: {
    fontFamily: "KanitSemiBold",
    fontSize: 12,
    color: "#ffffffff",
  },
  meta: {
    fontFamily: "KanitMedium",
    color: "#6B7280",
    marginTop: 2,
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 10 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  primary: { backgroundColor: "#3B82F6" },
  primaryText: { color: "#fff", fontFamily: "KanitSemiBold" },
  ghost: { backgroundColor: "#F3F4F6" },
  ghostText: { color: "#111827", fontFamily: "KanitSemiBold" },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: "KanitSemiBold",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
  },
  modalBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  modalBtnText: { color: "#fff", fontFamily: "KanitSemiBold", fontSize: 14 },
  modalCancel: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
});
