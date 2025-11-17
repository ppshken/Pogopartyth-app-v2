import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Modal
} from "react-native";
import { useRouter } from "expo-router";
import { api } from "../../lib/api";
import { useAuth } from "../../store/authStore";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { updateStatus } from "../../lib/raid"; // ✅ เพิ่ม import
import { MyRoomCard, parseStart } from "../../components/MyRoomCard";
import { showSnack } from "../../components/Snackbar";

type MyRoom = {
  id: number;
  raid_boss_id: number;
  pokemon_image: string;
  boss: string;
  start_time: string;
  status: "active" | "closed" | "canceled" | "invited" | string;
  max_members: number;
  current_members?: number;
  is_full?: boolean;
  note?: string | null;
  owner_id?: number;
  role?: "owner" | "member";
  owner?: { id: number; username: string; avatar?: string | null } | null;
};

export default function MyRaid() {
  const [rooms, setRooms] = useState<MyRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [closeloading, setCloseLoading] = useState(false);
  const router = useRouter();
  const me = useAuth((s) => s.user);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/api/raid/my_rooms.php", {
        validateStatus: () => true,
      });
      if (data?.success) {
        const arr: MyRoom[] = data.data?.rooms || data.data?.items || [];
        setRooms(arr);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useRefetchOnFocus(load, [load]);

  // ✅ helper: เป็นเจ้าของห้องนี้ไหม
  const isOwner = useCallback(
    (r: MyRoom) => r.role === "owner" || (!!me?.id && r.owner_id === me.id),
    [me?.id]
  );

  // ✅ เมื่อกดการ์ด
  const onPressRoom = useCallback(
    async (r: MyRoom) => {
      const expired = parseStart(r.start_time).getTime() <= Date.now();

      // ✅ ใครกดก็ได้: ถ้าหมดเวลาและยัง active ให้ปิดห้องทันที
      if (expired && r.status === "active") {
        setCloseLoading(true);
        try {
          await updateStatus(r.id, "closed");
          showSnack({ text: "ปิดห้องแล้วเรียบร้อย เนื่องจากหมดเวลา", variant: "success" });
          await load(); // รีเฟรช list
        } catch (e: any) {
          showSnack({ text: "ปิดห้องไม่สำเร็จ", variant: "error" });
        } finally {
          setCloseLoading(false);
        }
        return; // ไม่ต้องเข้าไปหน้า room ต่อ
      }

      // กรณีอื่น ๆ เข้าหน้าห้องตามปกติ
      router.push(`/rooms/${r.id}`);
    },
    [load, router]
  );

  const { created, joined } = useMemo(() => {
    const _isCreated = (r: MyRoom) => isOwner(r);
    const createdList = rooms.filter(_isCreated);
    const joinedList = rooms.filter((r) => !_isCreated(r));
    const byTimeAsc = (a: MyRoom, b: MyRoom) =>
      parseStart(a.start_time).getTime() - parseStart(b.start_time).getTime();
    return {
      created: [...createdList].sort(byTimeAsc),
      joined: [...joinedList].sort(byTimeAsc),
    };
  }, [rooms, isOwner]);

  if (loading && !rooms.length) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="small" color="#020202ff" />
      </View>
    );
  }

  return (
    <>
      <FlatList
        style={{ flex: 1, backgroundColor: "#F9FAFB" }}
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        data={[{ type: "created" }, { type: "joined" }]}
        keyExtractor={(it) => it.type}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
        renderItem={({ item }) => {
          const isCreatedSection = item.type === "created";
          const data = isCreatedSection ? created : joined;
          return (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  {isCreatedSection ? "ห้องที่สร้าง" : "ห้องที่เข้าร่วม"} {data.length? `(${data.length})` : ""}
                </Text>
              </View>

              {data.length === 0 ? (
                <Text style={{ color: "#9CA3AF", paddingVertical: 8, fontSize: 14, fontFamily: "KanitMedium" }}>
                  {isCreatedSection
                    ? "ยังไม่มีห้องที่คุณสร้าง"
                    : "ยังไม่มีห้องที่คุณเข้าร่วม"}
                </Text>
              ) : (
                data.map((r) => (
                  <MyRoomCard
                    key={r.id}
                    room={r}
                    isCreatedSection={isCreatedSection}
                    onPress={() => onPressRoom(r)}
                  />
                ))
              )}
            </View>
          );
        }}
      />
      
      <Modal visible={closeloading} transparent animationType="fade">
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: 'rgba(0,0,0,0.4)' }}>
          <ActivityIndicator size="small" color="#020202ff" />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontFamily: "KanitSemiBold",
    color: "#111827",
  },
});
