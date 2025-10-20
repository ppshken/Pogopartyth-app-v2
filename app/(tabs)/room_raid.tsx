// app/(tabs)/room_raid.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useLayoutEffect,
} from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { useRouter, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { listRooms } from "../../lib/raid";
import { RoomCardMinimal } from "../../components/RoomCard";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import HowToJoinRoomModal from "../../components/HowToJoinRoomModal";

type Room = {
  id: number;
  raid_boss_id: number;
  pokemon_image: string;
  boss: string;
  start_time: string; // "YYYY-MM-DD HH:mm:ss"
  status: string;
  current_members: number;
  max_members: number;
  note?: string | null;
  owner_username: string;
  pokemon_tier: number;
  is_joined: number;
};

export default function RoomsIndex() {
  const [items, setItems] = useState<Room[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [selectedBossId, setSelectedBossId] = useState<number | null>(null); // ✅ ตัวกรองบอส
  const router = useRouter();
  const navigation = useNavigation();
  const [howto, setHowto] = useState(false);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setHowto(true)}
          style={{ paddingHorizontal: 12, paddingVertical: 6 }}
          accessibilityRole="button"
          accessibilityLabel="วิธีการใช้งาน"
        >
          <Ionicons name="help-circle-outline" size={22} color="#111827" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  const load = useCallback(async () => {
    try {
      const res = await listRooms({ status: "active", page: 1, limit: 100 });
      setItems(res.items || res.rooms || []);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useRefetchOnFocus(load, [load]);
  useEffect(() => {
    load();
  }, [load]);

  // ✅ ตัวเลือกบอสแบบ unique จากรายการที่โหลดมา
  const bossOptions = useMemo(() => {
    const map = new Map<number, { id: number; name: string; image: string }>();
    for (const r of items) {
      if (!map.has(r.raid_boss_id)) {
        map.set(r.raid_boss_id, {
          id: r.raid_boss_id,
          name: r.boss,
          image: r.pokemon_image,
        });
      }
    }
    return Array.from(map.values());
  }, [items]);

  // ✅ กรองตามบอส (ถ้ามี) แล้วค่อยกรองด้วยคำค้นหา
  const filtered = useMemo(() => {
    let arr = items;
    if (selectedBossId) {
      arr = arr.filter((r) => r.raid_boss_id === selectedBossId);
    }
    const s = q.trim().toLowerCase();
    if (!s) return arr;
    return arr.filter((r) => {
      const boss = (r.boss || "").toLowerCase();
      const owner = (r.owner_username || "").toLowerCase();
      return boss.includes(s) || owner.includes(s);
    });
  }, [items, q, selectedBossId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
  };

  const toggleBoss = (id: number | null) => {
    setSelectedBossId((curr) => (curr === id ? null : id));
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      {/* แถบค้นหา */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color="#6B7280" />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="ค้นหาตามชื่อบอส หรือชื่อหัวห้อง"
          placeholderTextColor="#9CA3AF"
          style={styles.searchInput}
        />
        {q ? (
          <TouchableOpacity onPress={() => setQ("")}>
            <Ionicons name="close-circle" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* แถบ Filter บอส */}
      <View style={styles.bossBar}>
        <FlatList
          data={[{ id: 0, name: "ทั้งหมด", image: "" }, ...bossOptions]}
          keyExtractor={(b) => String(b.id)}
          horizontal
          bounces={false}                 // iOS: ไม่เด้ง
          alwaysBounceVertical={false}    // iOS: ไม่บังคับเด้ง
          overScrollMode="never"          // Android: ปิด overscroll glow
          showsHorizontalScrollIndicator={false}
          // ให้ content สูงเท่าบาร์ และจัดให้อยู่กลางแนวแกนตั้ง
          contentContainerStyle={styles.bossBarContent}
          renderItem={({ item }) => {
            const isAll = item.id === 0;
            const focused = isAll
              ? selectedBossId === null
              : selectedBossId === item.id;
            return (
              <TouchableOpacity
                onPress={() => toggleBoss(isAll ? null : item.id)}
                style={[
                  styles.bossChip,
                  focused ? styles.bossChipActive : styles.bossChipIdle,
                ]}
                activeOpacity={0.9}
              >
                {!isAll ? (
                  <Image source={{ uri: item.image }} style={styles.bossImg} />
                ) : (
                  <View style={[styles.bossImg, styles.bossImgAll]}>
                    <Text
                      style={{
                        fontSize: 10,
                        fontWeight: "800",
                        color: "#111827",
                      }}
                    >
                      ALL
                    </Text>
                  </View>
                )}

                <Text
                  style={[
                    styles.bossText,
                    focused ? { color: "#111827" } : { color: "#374151" },
                  ]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                  allowFontScaling={false}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
          removeClippedSubviews={false} // กันการคำนวณความสูงแปลก ๆ บางเคส
        />
      </View>
      
      {/* รายการห้อง */}
      <FlatList
        data={filtered}
        keyExtractor={(it) => String(it.id)}
        contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text
            style={{ color: "#9CA3AF", textAlign: "center", marginTop: 24, fontSize: 16, fontFamily: "KanitMedium" }}
          >
            {q || selectedBossId ? "ไม่พบห้องที่ตรงกับตัวกรอง" : "ยังไม่มีห้อง"}
          </Text>
        }
        renderItem={({ item }) => (
          <RoomCardMinimal
            room={item}
            onPress={() => router.push(`/rooms/${item.id}`)}
          />
        )}
      />
      <HowToJoinRoomModal visible={howto} onClose={() => setHowto(false)} />
    </View>
  );
}

const CHIP_H = 40; // สูงของชิป
const BAR_H = 56; // สูงของแถบตัวเลือกทั้งหมด

const styles = StyleSheet.create({
  searchWrap: {
    marginTop: 12,
    marginHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  searchInput: { flex: 1, color: "#111827", fontSize: 14, fontFamily: "KanitMedium" },

  // ✅ บาร์ตัวเลือก “สูงคงที่”
  bossBar: {
    height: BAR_H,
    backgroundColor: "#F9FAFB",
  },
  bossBarContent: {
    height: BAR_H, // ล็อกความสูงเท่าบาร์
    paddingHorizontal: 16                             ,
    gap: 8,
    alignItems: "center", // จัดชิปให้อยู่กลางแนวตั้งเสมอ
  },

  // ✅ ชิปคงที่ ไม่เด้ง
  bossChip: {
    height: CHIP_H, // ล็อกความสูงชิป
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
  },
  bossChipIdle: { borderColor: "#E5E7EB" },
  bossChipActive: { borderColor: "#111827", backgroundColor: "#E5E7EB" },

  bossImg: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: "#F3F4F6",
  },
  bossImgAll: { alignItems: "center", justifyContent: "center" },

  bossText: {
    fontSize: 14,
    fontFamily: "KanitSemiBold",
    lineHeight: 16, // ฟิกบรรทัด กันสูงเปลี่ยน
    maxWidth: 110, // กันชื่อยาวห่อบรรทัด
  },
});
