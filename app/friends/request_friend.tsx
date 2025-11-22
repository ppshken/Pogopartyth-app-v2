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
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  GetPendingFriends,
  AcceptFriend,
  DeclineFriend,
  getInbox_list,
} from "@/lib/friend";
import { showSnack } from "../../components/Snackbar";
import { router } from "expo-router";
import { minutesAgoTH } from "../../hooks/useTimeAgoTH";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";

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

type Inbox = {
  id: number;
  friendship_id: number;
  sender: number;
  username: string;
  avatar?: string | null;
  message: string;
  created_at: string;
};

const PAGE_SIZE = 20;

// สร้าง Type สำหรับ Tab
type TabType = "requests" | "inbox";

export default function RequestFriend() {
  // State สำหรับ Tab
  const [activeTab, setActiveTab] = useState<TabType>("requests");

  const [items, setItems] = useState<PendingItem[]>([]);
  const [inboxitems, setInboxItems] = useState<Inbox[]>([]);
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

      // โหลดทั้งสองอย่างเพื่อให้ตัวเลข Badge อัปเดตเสมอ
      const [resPending, resInbox] = await Promise.all([
        GetPendingFriends({ page: p, limit: PAGE_SIZE }),
        getInbox_list(),
      ]);

      setInboxItems(resInbox);
      setHasMore(!!resPending.pagination?.has_more);
      setPage(resPending.pagination?.page || p);
      setItems((prev) =>
        append ? [...prev, ...resPending.list] : resPending.list
      );
    } catch (e: any) {
      setError(e?.message || "โหลดรายการไม่สำเร็จ");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useRefetchOnFocus(load, [load]);

  useEffect(() => {
    load(1, false);
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(1, false);
  };

  const loadMore = () => {
    // Load more เฉพาะ Tab คำขอเพื่อน (เพราะ Inbox มักจะมาทีเดียวหมด หรือต้องทำ Pagination แยก)
    if (activeTab === "requests" && !loading && hasMore) {
      load(page + 1, true);
    }
  };

  // ... (ฟังก์ชันเดิม openChat, accept, declin, formatCode คงไว้เหมือนเดิม) ...
  const openChat = async (inboxitems: Inbox) => {
    router.push({
      pathname: `/friends/chat`,
      params: {
        friendshipId: String(inboxitems.friendship_id),
        other_user_id: String(inboxitems?.sender),
        other_username: inboxitems?.username,
        other_avatar: inboxitems?.avatar,
      },
    });
  };

  const accept = async (requester_id: number) => {
    setLoadingAccept(true);
    try {
      await AcceptFriend(requester_id);
      showSnack({ text: "รับเพื่อนแล้วเรียบร้อย", variant: "success" });
      setOnmodal(false);
      setLoadingAccept(false);
      load();
    } catch (e: any) {
      showSnack({ text: e?.message || "รับเพื่อนล้มเหลว", variant: "error" });
    } finally {
      setLoadingAccept(false);
      setOnmodal(false);
    }
  };

  const declin = async (requester_id: number) => {
    setLoadingDeclin(true);
    try {
      await DeclineFriend(requester_id);
      showSnack({ text: "ปฏิเสธเพื่อนแล้วเรียบร้อย", variant: "success" });
      load();
    } catch (e: any) {
      showSnack({ text: e?.message || "ปฏิเสธล้มเหลว", variant: "error" });
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

  // ... (Row Components เดิม) ...
  const Row = ({ item }: { item: PendingItem }) => {
    const teamColors: Record<string, string> = {
      Mystic: "#3B82F6",
      Valor: "#EF4444",
      Instinct: "#FBBF24",
    };
    return (
      <TouchableOpacity
        style={s.card}
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
              style={{ flexDirection: "row", gap: 8, alignItems: "center" }}
            >
              <Text style={s.username} numberOfLines={1}>
                {item.username}
              </Text>
              {item.team && (
                <View
                  style={[s.team, { backgroundColor: teamColors[item.team] }]}
                >
                  <Text style={s.metalevel}>Lv {item.level}</Text>
                </View>
              )}
            </View>
            <Text style={s.timeago}>
              {minutesAgoTH(item.created_at as string)}
            </Text>
          </View>
          <Text style={s.meta}>Code: {formatCode(item.friend_code)}</Text>
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
                <ActivityIndicator size="small" color="#111827" />
              ) : (
                <>
                  <Ionicons name="close" size={16} color="#111827" />
                  <Text style={s.ghostText}>ปฏิเสธ</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const InboxRow = ({ item }: { item: Inbox }) => {
    return (
      <TouchableOpacity style={s.card} onPress={() => openChat(item)}>
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
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              gap: 8,
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Text style={s.username} numberOfLines={1}>
              {item.username}
            </Text>
            <Text style={s.timeago}>
              {minutesAgoTH(item.created_at as string)}
            </Text>
          </View>
          <Text style={s.meta} numberOfLines={2}>
            {item.message}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // --- Render Tab Header ---
  const renderTabs = () => (
    <View style={s.tabContainer}>
      <TouchableOpacity
        style={[s.tabBtn, activeTab === "requests" && s.tabBtnActive]}
        onPress={() => setActiveTab("requests")}
      >
        <Text style={[s.tabText, activeTab === "requests" && s.tabTextActive]}>
          คำขอเพื่อน
        </Text>
        {items.length > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>
              {items.length > 99 ? "99+" : items.length}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.tabBtn, activeTab === "inbox" && s.tabBtnActive]}
        onPress={() => setActiveTab("inbox")}
      >
        <Text style={[s.tabText, activeTab === "inbox" && s.tabTextActive]}>
          ข้อความ
        </Text>
        {inboxitems.length > 0 && (
          <View style={s.badge}>
            <Text style={s.badgeText}>
              {inboxitems.length > 99 ? "99+" : inboxitems.length}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={s.container}>
      {/* Tab Header */}
      {renderTabs()}

      {error && (
        <TouchableOpacity style={s.errorBox} onPress={() => load(1, false)}>
          <Ionicons name="warning-outline" size={16} color="#991B1B" />
          <Text style={s.errorText}>{error} — แตะเพื่อลองใหม่</Text>
        </TouchableOpacity>
      )}

      {/* Content Area */}
      <View style={{ flex: 1 }}>
        {activeTab === "requests" ? (
          <FlatList
            data={items}
            keyExtractor={(it) => String(it.request_id)}
            renderItem={Row}
            ListEmptyComponent={
              !loading ? (
                <View style={s.emptyContainer}>
                  <Ionicons name="people-outline" size={48} color="#9CA3AF" />
                  <Text style={s.emptyText}>ยังไม่มีคำขอเป็นเพื่อน</Text>
                </View>
              ) : null
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={s.listContent}
            onEndReachedThreshold={0.2}
            onEndReached={loadMore}
            ListFooterComponent={
              loading ? <ActivityIndicator style={{ margin: 20 }} /> : null
            }
          />
        ) : (
          <FlatList
            data={inboxitems}
            keyExtractor={(it) => String(it.username + it.created_at)}
            renderItem={InboxRow}
            ListEmptyComponent={
              !loading ? (
                <View style={s.emptyContainer}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={48}
                    color="#9CA3AF"
                  />
                  <Text style={s.emptyText}>ยังไม่มีข้อความใหม่</Text>
                </View>
              ) : null
            }
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            contentContainerStyle={s.listContent}
            ListFooterComponent={
              loading ? <ActivityIndicator style={{ margin: 20 }} /> : null
            }
          />
        )}
      </View>

      {/* Modal */}
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
              onPress={() => accept(selected)}
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
  // Tabs Styles
  tabContainer: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
    flexDirection: "row",
    gap: 6,
  },
  tabBtnActive: {
    borderBottomColor: "#3B82F6",
  },
  tabText: {
    fontFamily: "KanitMedium",
    fontSize: 16,
    color: "#6B7280",
  },
  tabTextActive: {
    color: "#3B82F6",
    fontFamily: "KanitSemiBold",
  },
  badge: {
    backgroundColor: "#EF4444",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontFamily: "KanitSemiBold",
  },
  // List Styles
  listContent: {
    padding: 14,
    paddingBottom: 30,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 60,
    gap: 10,
  },
  emptyText: {
    fontFamily: "KanitMedium",
    color: "#9CA3AF",
    fontSize: 16,
  },
  // Existing Styles
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    margin: 12,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#E5E7EB",
  },
  username: {
    fontFamily: "KanitSemiBold",
    fontSize: 16,
    color: "#111827",
    flexShrink: 1,
  },
  timeago: { fontFamily: "KanitMedium", fontSize: 12, color: "#9CA3AF" },
  team: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: 6,
  },
  metalevel: { fontFamily: "KanitSemiBold", fontSize: 10, color: "#fff" },
  meta: {
    fontFamily: "KanitMedium",
    color: "#6B7280",
    marginTop: 2,
    fontSize: 13,
  },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
  },
  primary: { backgroundColor: "#3B82F6" },
  primaryText: { color: "#fff", fontFamily: "KanitSemiBold" },
  ghost: { backgroundColor: "#F3F4F6" },
  ghostText: { color: "#111827", fontFamily: "KanitSemiBold" },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "KanitSemiBold",
    color: "#111827",
    marginBottom: 20,
  },
  modalBtn: {
    width: "100%",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  modalBtnText: { color: "#fff", fontFamily: "KanitSemiBold", fontSize: 16 },
  modalCancel: { backgroundColor: "#F3F4F6", marginTop: 0, marginBottom: 0 },
});
