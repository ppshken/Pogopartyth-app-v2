// app/(tabs)/friends.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  TouchableOpacity,
  Keyboard,
} from "react-native";
import { Friend, searchFriends, listMyFriends } from "../../lib/friend";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AvatarComponent } from "../../components/Avatar";

// แยกสีออกมาเป็น Constant
const TEAM_COLORS: Record<string, string> = {
  Mystic: "#3B82F6",
  Valor: "#EF4444",
  Instinct: "#FBBF24",
};

type Tab = "search" | "mine";

export default function FriendsScreen() {
  const router = useRouter();

  // State
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Friend[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Counts
  const [friendAll, setFriendAll] = useState(0);
  const [myFriendAll, setMyFriendAll] = useState(0);

  const [tab, setTab] = useState<Tab>("search");

  // Ref เพื่อป้องกัน Race Condition
  const currentRequestRef = useRef<{
    q: string;
    tab: Tab;
    page: number;
  } | null>(null);

  // Debounce Logic
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const onChangeQ = (text: string) => {
    setQ(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchFirst(text, tab);
    }, 400);
  };

  // API Fetch Logic
  const fetchPage = useCallback(
    async (pageNum: number, replace = false, keyword = q, currentTab = tab) => {
      if (loading && !replace) return;

      setLoading(true);
      setError(null);

      const thisRequest = { q: keyword, tab: currentTab, page: pageNum };
      currentRequestRef.current = thisRequest;

      try {
        let res;

        if (currentTab === "search") {
          res = await searchFriends({ q: keyword, page: pageNum, limit: 10 });
          setFriendAll(res.pagination.user_all);
        } else {
          res = await listMyFriends({ q: keyword, page: pageNum, limit: 10 });
          setMyFriendAll(res.pagination.user_all);
        }

        // Race Condition Check
        if (
          currentRequestRef.current.q !== keyword ||
          currentRequestRef.current.tab !== currentTab ||
          currentRequestRef.current.page !== pageNum
        ) {
          return;
        }

        setItems((prev) => (replace ? res.list : [...prev, ...res.list]));
        setHasMore(res.pagination.has_more);
        setPage(res.pagination.page);
      } catch (e: any) {
        setError(e?.message || "โหลดไม่สำเร็จ");
        if (replace) setItems([]);
      } finally {
        if (
          currentRequestRef.current?.q === keyword &&
          currentRequestRef.current?.tab === currentTab &&
          currentRequestRef.current?.page === pageNum
        ) {
          setLoading(false);
        }
      }
    },
    [loading, q, tab]
  );

  const fetchFirst = useCallback(
    (keyword = q, currentTab = tab) => {
      fetchPage(1, true, keyword, currentTab);
    },
    [fetchPage, q, tab]
  );

  // ✅ แก้ไขจุดที่ 1: โหลดครั้งแรก ให้ดึงจำนวนเพื่อน (My Friends) มาด้วยเลย
  useEffect(() => {
    // 1. โหลดลิสต์หลัก (Tab search)
    fetchFirst("", "search");

    // 2. แอบโหลดจำนวนเพื่อนของฉันมาแสดง (เรียกแค่ limit 1 พอ เพื่อเอา count)
    listMyFriends({ page: 1, limit: 1 })
      .then((res) => {
        setMyFriendAll(res.pagination.user_all);
      })
      .catch(() => {
        /* ปล่อยผ่าน */
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tab Change
  useEffect(() => {
    fetchFirst(q, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const onEndReached = () => {
    if (!loading && hasMore) {
      fetchPage(page + 1);
    }
  };

  const clearQ = () => {
    setQ("");
    fetchFirst("", tab);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFirst(q, tab);

    // ถ้า refresh ก็อัปเดตจำนวนเพื่อนด้วย
    listMyFriends({ page: 1, limit: 1 })
      .then((res) => setMyFriendAll(res.pagination.user_all))
      .catch(() => {});

    setRefreshing(false);
  };

  const renderItem = useCallback(
    ({ item }: { item: Friend }) => {
      // ✅ แก้ไขจุดที่ 2: ถ้าเป็นเพื่อนกันแล้ว (is_friend) หรือ อยู่ในแท็บ Mine ให้เป็นสีฟ้า
      const isFriendStyle = item.is_friend || tab === "mine";

      return (
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.push(`/friends/${item.id}`)}
          style={[
            styles.itemContainer,
            isFriendStyle && styles.itemFriendActive, // ใช้เงื่อนไขใหม่ตรงนี้
          ]}
        >
          <AvatarComponent
            avatar={item.avatar}
            username={item.username}
            plan={item.plan}
            width={48}
            height={48}
            borderRadius={24}
            fontsize={10}
            iconsize={10}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <View style={styles.rowCenterGap}>
              <Text style={styles.itemName}>{item.username}</Text>
              <View
                style={[
                  styles.teamBadge,
                  {
                    backgroundColor: TEAM_COLORS[item.team ?? ""] ?? "#9CA3AF",
                  },
                ]}
              >
                <Text style={styles.teamText}>Level {item.level}</Text>
              </View>
            </View>

            <View style={[styles.rowCenterGap, { marginTop: 0 }]}>
              {item.rating_owner ? (
                <>
                  <Ionicons name="star" size={14} color="#FBBF24" />
                  <Text style={styles.subTextBlack}>{item.rating_owner}</Text>
                </>
              ) : (
                <Text style={styles.subTextGray}>-</Text>
              )}
            </View>

            {item.friend_code_masked && (
              <Text style={styles.subTextGray}>
                Friend code: {item.friend_code_masked}
              </Text>
            )}
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      );
    },
    [router, tab]
  ); // ✅ เพิ่ม tab ใน dependency

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <View style={styles.header}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#6B7280" />
          <TextInput
            placeholder="ค้นหาเพื่อน (ชื่อ / Friend code)"
            placeholderTextColor="#9CA3AF"
            value={q}
            onChangeText={onChangeQ}
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={() => fetchFirst(q, tab)}
          />
          {q ? (
            <TouchableOpacity onPress={clearQ}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          <TabButton
            active={tab === "search"}
            label={`หาเพื่อน (${friendAll})`}
            onPress={() => setTab("search")}
          />
          <TabButton
            active={tab === "mine"}
            label={`เพื่อนของฉัน (${myFriendAll})`}
            onPress={() => setTab("mine")}
          />
        </View>

        {error && <Text style={styles.errorText}>⚠️ {error}</Text>}
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>ไม่พบผลลัพธ์ที่ค้นหา</Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          loading ? (
            <View style={{ padding: 16 }}>
              <ActivityIndicator />
            </View>
          ) : hasMore ? (
            <View style={{ height: 12 }} />
          ) : (
            <View style={{ height: 24 }} />
          )
        }
      />
    </View>
  );
}

const TabButton = ({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    style={[
      styles.tabButton,
      {
        backgroundColor: active ? "#FFFFFF" : "transparent",
        borderColor: active ? "#E5E7EB" : "transparent",
      },
    ]}
  >
    <Text
      style={{
        fontFamily: "KanitSemiBold",
        color: active ? "#111827" : "#6B7280",
      }}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  searchBox: {
    backgroundColor: "white",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchInput: {
    fontSize: 14,
    flex: 1,
    color: "#111827",
    fontFamily: "KanitMedium",
  },
  tabContainer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
    backgroundColor: "#F3F4F6",
    padding: 4,
    borderRadius: 10,
    marginBottom: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    borderWidth: 1,
  },
  errorText: { color: "#B91C1C", marginTop: 8 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyContainer: { padding: 24, alignItems: "center" },
  emptyText: { color: "#6B7280", fontFamily: "KanitMedium", fontSize: 16 },

  // Item Styles
  itemContainer: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "#ffffffff",
    borderColor: "#E5E7EB",
    marginBottom: 12,
    alignItems: "center",
  },
  itemFriendActive: {
    backgroundColor: "#dde9f5ff", // สีฟ้าเมื่อเป็นเพื่อน
  },
  rowCenterGap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  itemName: {
    fontFamily: "KanitSemiBold",
    fontSize: 16,
  },
  teamBadge: {
    padding: 2,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  teamText: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "KanitSemiBold",
  },
  subTextBlack: {
    color: "#000000",
    fontFamily: "KanitMedium",
    marginTop: 0,
  },
  subTextGray: {
    color: "#6B7280",
    marginTop: 0,
    fontFamily: "KanitMedium",
  },
});
