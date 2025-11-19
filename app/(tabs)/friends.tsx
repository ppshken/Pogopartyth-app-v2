// app/(tabs)/friends.tsx
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useLayoutEffect,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  Text,
  TextInput,
  View,
  TouchableOpacity,
} from "react-native";
import {
  Friend,
  searchFriends,
  avatarOrFallback,
  listMyFriends,
} from "../../lib/friend"; // ✅ เพิ่ม listMyFriends
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AvatarComponent } from "../../components/Avatar";

type Tab = "search" | "mine";

export default function FriendsScreen() {
  // ----- ค้นหา/ผลลัพธ์/เพจิ้ง -----
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Friend[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [friendAll, setFriendAll] = useState(0);
  const [MyfriendAll, setMyFriendAll] = useState(0);

  // ----- แท็บ: search | mine -----
  const [tab, setTab] = useState<Tab>("search");

  const router = useRouter();

  // ----- debounce คำค้น -----
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const onChangeQ = (text: string) => {
    setQ(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // ค้นหาใหม่เฉพาะในแท็บ "หาเพื่อน"
      if (tab === "search") fetchFirst(text);
      // ถ้าอยู่แท็บ "เพื่อนของฉัน" ให้กรองรายชื่อเพื่อนด้วยคีย์เวิร์ดเดิม
      if (tab === "mine") fetchFirst(text);
    }, 400);
  };

  // ----- ดึงข้อมูลตามหน้า + โหมด -----
  const fetchPage = useCallback(
    async (pageNum: number, replace = false, keyword = q, currentTab = tab) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        let res: {
          list: Friend[];
          pagination: { page: number; has_more: boolean; user_all: number };
        };

        if (currentTab === "search") {
          // โหมดค้นหาทุกคน
          res = await searchFriends({ q: keyword, page: pageNum, limit: 10 });
          setFriendAll(res.pagination.user_all);
        } else {
          // โหมดเพื่อนของฉัน (อาจกรองด้วยคีย์เวิร์ด)
          res = await listMyFriends({ q: keyword, page: pageNum, limit: 10 });
          setMyFriendAll(res.pagination.user_all);
        }

        setItems((prev) => (replace ? res.list : [...prev, ...res.list]));
        setHasMore(res.pagination.has_more);
        setPage(res.pagination.page);
      } catch (e: any) {
        setError(e?.message || "โหลดไม่สำเร็จ");
        if (replace) setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [loading, q, tab]
  );

  // ----- ดึงหน้าแรก -----
  const fetchFirst = useCallback(
    async (keyword = q, currentTab = tab) => {
      setItems([]);
      await fetchPage(1, true, keyword, currentTab);
    },
    [fetchPage, q, tab]
  );

  // ----- โหลดรอบแรก -----
  useEffect(() => {
    fetchFirst("", "search");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- เปลี่ยนแท็บแล้วรีโหลด -----
  useEffect(() => {
    fetchFirst(q, tab);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ----- โหลดเพิ่มเมื่อสุดรายการ -----
  const onEndReached = () => {
    if (!loading && hasMore) {
      fetchPage(page + 1);
    }
  };

  // ----- เคลียร์คำค้นแล้วรีโหลดตามแท็บปัจจุบัน -----
  const clearq = () => {
    setQ("");
    fetchFirst("", tab);
  };

  // ----- รีเฟรชตามแท็บปัจจุบัน -----
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFirst(q, tab);
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Friend }) => {
    const teamColors: Record<string, string> = {
      Mystic: "#3B82F6", // น้ำเงิน
      Valor: "#EF4444", // แดง
      Instinct: "#FBBF24", // เหลือง
    };
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => router.push(`/friends/${item.id}`)}
        style={{
          flexDirection: "row",
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 14,
          backgroundColor: item.is_friend ? "#dde9f5ff" : "#FFFFFF",
          borderWidth: 1,
          borderColor: "#E5E7EB",
          marginBottom: 12,
          alignItems: "center",
        }}
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
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontFamily: "KanitSemiBold", fontSize: 16 }}>
              {item.username}
            </Text>
            <View
              style={{
                backgroundColor: teamColors[item.team ?? ""] ?? "#9CA3AF",
                padding: 2,
                paddingHorizontal: 4,
                borderRadius: 4,
              }}
            >
              <Text
                style={{
                  color: "#ffffffff",
                  fontSize: 12,
                  fontFamily: "KanitSemiBold",
                }}
              >
                Level {item.level}
              </Text>
            </View>
          </View>

          {item.rating_owner ? (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons name="star" size={14} color="#FBBF24" />
              <Text
                style={{
                  color: "#000000ff",
                  marginTop: 2,
                  fontFamily: "KanitMedium",
                }}
              >
                {item.rating_owner}
              </Text>
            </View>
          ) : (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Text
                style={{
                  color: "#6B7280",
                  marginTop: 2,
                  fontFamily: "KanitMedium",
                }}
              >
                -
              </Text>
            </View>
          )}

          {item.friend_code_masked ? (
            <Text
              style={{
                color: "#6B7280",
                marginTop: 2,
                fontFamily: "KanitMedium",
              }}
            >
              Friend code: {item.friend_code_masked}
            </Text>
          ) : null}
        </View>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      {/* แถบค้นหา */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 }}>
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 12,
            paddingHorizontal: 12,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <Ionicons name="search-outline" size={18} color="#6B7280" />
          <TextInput
            placeholder="ค้นหาเพื่อน (ชื่อ / Friend code)"
            placeholderTextColor="#9CA3AF"
            value={q}
            onChangeText={onChangeQ}
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              fontSize: 14,
              flex: 1,
              color: "#111827",
              fontFamily: "KanitMedium",
            }}
            returnKeyType="search"
            onSubmitEditing={() => fetchFirst(q, tab)}
          />
          {q ? (
            <TouchableOpacity onPress={clearq}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ✅ แท็บใต้ช่องค้นหา */}
        <View
          style={{
            flexDirection: "row",
            gap: 8,
            marginTop: 12,
            backgroundColor: "#F3F4F6",
            padding: 4,
            borderRadius: 10,
            marginBottom: 4,
          }}
        >
          {/* แท็บหาเพื่อน*/}
          <TouchableOpacity
            onPress={() => setTab("search")}
            activeOpacity={0.8}
            style={{
              flex: 1,
              backgroundColor: tab === "search" ? "#FFFFFF" : "transparent",
              paddingVertical: 10,
              borderRadius: 8,
              alignItems: "center",
              borderWidth: 1,
              borderColor: tab === "search" ? "#E5E7EB" : "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: "KanitSemiBold",
                color: tab === "search" ? "#111827" : "#6B7280",
              }}
            >
              หาเพื่อน ({friendAll})
            </Text>
          </TouchableOpacity>

          {/* แท็บเพื่อน*/}
          <TouchableOpacity
            onPress={() => setTab("mine")}
            activeOpacity={0.8}
            style={{
              flex: 1,
              backgroundColor: tab === "mine" ? "#FFFFFF" : "transparent",
              paddingVertical: 10,
              borderRadius: 8,
              alignItems: "center",
              borderWidth: 1,
              borderColor: tab === "mine" ? "#E5E7EB" : "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: "KanitSemiBold",
                color: tab === "mine" ? "#111827" : "#6B7280",
              }}
            >
              เพื่อนของฉัน ({MyfriendAll})
            </Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <Text style={{ color: "#B91C1C", marginTop: 8 }}>⚠️ {error}</Text>
        ) : null}
      </View>

      <FlatList
        data={items}
        keyExtractor={(it) => String(it.id)}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.3}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={{ padding: 24, alignItems: "center" }}>
              <Text
                style={{
                  color: "#6B7280",
                  fontFamily: "KanitMedium",
                  fontSize: 16,
                }}
              >
                ไม่พบผลลัพธ์ที่ค้นหา
              </Text>
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
