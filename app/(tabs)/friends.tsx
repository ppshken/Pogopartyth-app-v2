// app/(tabs)/friends.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
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
import { Friend, searchFriends, avatarOrFallback } from "../../lib/friend";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function FriendsScreen() {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Friend[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  // debounce คำค้น
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const onChangeQ = (text: string) => {
    setQ(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchFirst(text);
    }, 400);
  };

  const fetchPage = useCallback(
    async (pageNum: number, replace = false, keyword = q) => {
      if (loading) return;
      setLoading(true);
      setError(null);
      try {
        const res = await searchFriends({
          q: keyword,
          page: pageNum,
          limit: 10,
        });
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
    [loading, q]
  );

  const fetchFirst = useCallback(
    async (keyword = q) => {
      setItems([]);
      await fetchPage(1, true, keyword);
    },
    [fetchPage, q]
  );

  useEffect(() => {
    // โหลดรอบแรก
    fetchFirst("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onEndReached = () => {
    if (!loading && hasMore) {
      fetchPage(page + 1);
    }
  };

  const clearq = () => {
    setQ("");
    fetchFirst("");
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFirst(q);
    setRefreshing(false);
  };

  const renderItem = ({ item }: { item: Friend }) => {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() =>
          router.push({
            pathname: "/rooms/[id]/friend",
            params: { id: Number(item.id) }, // ต้องแมพกับ [id]
          })
        }
        style={{
          flexDirection: "row",
          padding: 12,
          borderRadius: 14,
          backgroundColor: "#FFFFFF",
          borderWidth: 1,
          borderColor: "#E5E7EB",
          marginBottom: 12,
          alignItems: "center",
        }}
      >
        <Image
          source={{ uri: avatarOrFallback(item.username, item.avatar) }}
          style={{ width: 48, height: 48, borderRadius: 24 }}
        />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontWeight: "700", fontSize: 16 }}>
              {item.username}
            </Text>
            <View
              style={{
                backgroundColor: "#eedcdcff",
                padding: 2,
                paddingHorizontal: 4,
                borderRadius: 4,
              }}
            >
              <Text
                style={{
                  color: "#ea0a0aff",
                  fontSize: 12,
                  fontWeight: "600",
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
              <Text style={{ color: "#000000ff", marginTop: 2 }}>
                {item.rating_owner}
              </Text>
            </View>
          ) : (
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <Ionicons name="star" size={14} color="#FBBF24" />
              <Text style={{ color: "#6B7280", marginTop: 2 }}>
                -
              </Text>
            </View>
          )}

          {item.friend_code_masked ? (
            <Text style={{ color: "#6B7280", marginTop: 2 }}>
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
      <View
        style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 }}
      >
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
          }}
        >
          <TextInput
            placeholder="ค้นหาเพื่อน (ชื่อ / Friend code)"
            value={q}
            onChangeText={onChangeQ}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ fontSize: 16 }}
            returnKeyType="search"
            onSubmitEditing={() => fetchFirst(q)}
          />
          {q ? (
            <TouchableOpacity onPress={clearq}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ) : null}
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
              <Text style={{ color: "#6B7280" }}>ไม่พบผลลัพธ์ที่ค้นหา</Text>
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
