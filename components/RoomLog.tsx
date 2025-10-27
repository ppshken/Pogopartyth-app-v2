import {
  StyleSheet,
  Text,
  View,
  Alert,
  Image,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import React, { useState, useCallback, useEffect, useMemo } from "react";
import { getRoomLog } from "@/lib/raid";

type Room = { id: number };

type RoomLogItem = {
  id: number;
  room_id: number;
  user_id: number;
  type: string;
  description: string | null;
  created_at: string;
  username: string | null;
  avatar: string | null;
};

export default function RoomLogComponent({ room }: { room: Room }) {
  const [items, setItems] = useState<RoomLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const roomId = room?.id ?? 0;

  // โหลดข้อมูล
  const load = useCallback(async () => {
    if (!roomId) return;
    try {
      setLoading(true);
      // สมมติ getRoomLog คืน { list: RoomLogItem[], pagination: {...} }
      const res = await getRoomLog(roomId);
      // ปรับตามรูปแบบผลลัพธ์จริงของคุณ
      const list: RoomLogItem[] = Array.isArray(res?.list)
        ? res.list
        : (res as any)?.data?.list ?? [];
      setItems(list);
    } catch (e: any) {
      console.log("load room log error:", e?.message || e);
      Alert.alert("โหลด Log ไม่สำเร็จ", e?.message || "ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  // โหลดครั้งแรกเมื่อ roomId เปลี่ยน
  useEffect(() => {
    load();
  }, [load]);

  // รีเฟรช
  const onRefresh = useCallback(async () => {
    if (!roomId) return;
    setRefreshing(true);
    try {
      const res = await getRoomLog(roomId);
      const list: RoomLogItem[] = Array.isArray(res?.list)
        ? res.list
        : (res as any)?.data?.list ?? [];
      setItems(list);
    } catch (e: any) {
      console.log("refresh room log error:", e?.message || e);
      Alert.alert("รีเฟรชไม่สำเร็จ", e?.message || "ลองใหม่อีกครั้ง");
    } finally {
      setRefreshing(false);
    }
  }, [roomId]);

  const keyExtractor = useCallback((it: RoomLogItem) => String(it.id), []);
  const Empty = useMemo(
    () =>
      !loading ? (
        <View style={{ padding: 24, alignItems: "center" }}>
          <Text style={{ color: "#6B7280", fontSize: 16 }}>
            ยังไม่มีประวัติในห้องนี้
          </Text>
          <Text style={{ color: "#9CA3AF", fontSize: 13, marginTop: 4 }}>
            เมื่อมีการสร้าง/เข้าห้อง/ออก/เชิญ/รีวิว จะมาแสดงที่นี่
          </Text>
        </View>
      ) : null,
    [loading]
  );

  const renderItem = useCallback(({ item }: { item: RoomLogItem }) => {
    const avatarUri =
      item?.avatar && item.avatar.startsWith("http")
        ? item.avatar
        : "https://ui-avatars.com/api/?name=" +
          encodeURIComponent(item?.username || "U") +
          "&background=E5E7EB&color=111827";

    return (
      <View style={styles.row}>
        <Image
          source={{ uri: avatarUri }}
          style={styles.avatar}
          onError={() => {
            // กรณีรูปแตกให้ fallback เป็นตัวอักษร
          }}
        />
        <View style={{ flex: 1 }}>
          <View style={styles.headerLine}>
            <Text style={styles.username}>{item.username || "Unknown"}</Text>
            <Text style={styles.dot}> · </Text>
            <Text style={styles.type}>{item.type}</Text>
            <Text style={styles.dot}> · </Text>
            <Text style={styles.time}>{item.created_at}</Text>
          </View>
          {!!item.description && (
            <Text style={styles.desc}>{item.description}</Text>
          )}
        </View>
      </View>
    );
  }, []);

  if (loading && items.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={{ marginTop: 8, color: "#6B7280" }}>
          กำลังโหลดประวัติ...
        </Text>
      </View>
    );
  }

  // Use FlatList so each item gets a proper key and built-in performance
  return (
    <FlatList
      data={items}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      refreshing={refreshing}
      onRefresh={onRefresh}
      ListEmptyComponent={Empty}
      contentContainerStyle={items.length === 0 ? { flex: 1 } : undefined}
      ItemSeparatorComponent={() => <View style={styles.sep} />}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", paddingVertical: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    backgroundColor: "#E5E7EB",
  },
  headerLine: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 2,
  },
  username: { fontSize: 14, fontWeight: "600" },
  type: { fontSize: 13, color: "#111827" },
  time: { fontSize: 12, color: "#6B7280" },
  dot: { color: "#9CA3AF" },
  desc: { fontSize: 14, color: "#111827" },
  sep: { height: 1, backgroundColor: "#E5E7EB" },
});
