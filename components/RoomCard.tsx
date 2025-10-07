import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TierStars } from "../components/TierStars";

type Room = {
  id: number;
  raid_boss_id: number;
  pokemon_image: string;
  boss: string;
  start_time: string;
  status: string;
  current_members: number;
  max_members: number;
  note?: string | null;
  owner_username: string;
  is_full?: boolean;
  pokemon_tier: number;
  is_joined: number;
};

function parseStart(s: string): Date {
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date(s) : d;
}

function useCountdown(start: string) {
  const target = useMemo(() => parseStart(start).getTime(), [start]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const diffMs = target - now;
  const expired = diffMs <= 0;
  if (expired) return { expired: true, label: "หมดเวลา" };

  const totalSec = Math.floor(diffMs / 1000);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  let label = "";
  if (hh > 0) label = `เหลือ ${hh} ชม. ${pad(mm)} นาที ${pad(ss)} วินาที`;
  else if (mm > 0) label = `เหลือ ${mm} นาที ${pad(ss)} วินาที`;
  else label = `เหลือ ${ss} วินาที`;

  return { expired: false, label };
}

export function RoomCardMinimal({
  room,
  onPress,
}: {
  room: Room;
  onPress?: () => void;
}) {
  const { label, expired } = useCountdown(room.start_time);

  const isFull = room.is_full ?? room.current_members >= room.max_members;

  // ใช้ “ค่าสีเป็นสตริง” เพื่อเลี่ยง TS งอ
  const statusBg = expired
    ? "#9CA3AF"
    : isFull
    ? "#EF4444"
    : room.status === "active"
    ? "#10B981"
    : "#111827";
  const statusText = expired
    ? "หมดเวลา"
    : isFull
    ? "เต็ม"
    : room.status === "active"
    ? "เปิดรับ"
    : room.status;

  const is_joinedbg = room.is_joined === 1 ? "#c6d9ebff" : "#ffffffff";

  return (
<Pressable
  onPress={onPress}
  style={({ pressed }) => [
    styles.card,
    { backgroundColor: is_joinedbg, borderColor: "#E5E7EB" }, // ✅ เพิ่มตรงนี้
    pressed && styles.pressed,
  ]}
>
  {/* แสดงรูปบอส */}
  <Image source={{ uri: room.pokemon_image }} style={styles.thumb} />

  <View style={{ flex: 1 }}>
    {/* แสดงชื่อบอสกับ เวลา */}
    <View style={styles.topRow}>
      <Text numberOfLines={1} style={styles.title}>
        {room.boss}
      </Text>
      <View
        style={[
          styles.countChip,
          { backgroundColor: expired ? "#E5E7EB" : "#3066dbff" },
        ]}
      >
        <Ionicons
          name="time-outline"
          size={14}
          color={expired ? "#6B7280" : "#fff"}
          style={{ marginRight: 4 }}
        />
        <Text style={[styles.countText, expired && { color: "#6B7280" }]}>
          {label}
        </Text>
      </View>
    </View>

    {/* แสดงจำนวนดาว */}
    <TierStars pokemon_tier={room.pokemon_tier} color="#ffcc00" />

    {/* แสดงหัวห้อง */}
    <Text numberOfLines={1} style={styles.owner}>
      หัวห้อง: {room.owner_username}
    </Text>

    {/* แสดงจำนวนคน กับ สถานะ */}
    <View style={styles.metaRow}>
      <View style={styles.people}>
        <Ionicons name="person" size={12} color="#374151" />
        <Text style={styles.metaText}>
          {" "}
          {room.current_members}/{room.max_members}
        </Text>
      </View>

      <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>
    </View>
  </View>
</Pressable>

  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
    alignItems: "center"
  },
  pressed: { opacity: 0.9 },
  thumb: { width: 72, height: 72, borderRadius: 10, backgroundColor: "#F3F4F6", marginRight: 12 },
  topRow: { flexDirection: "row", alignItems: "center" },
  title: { flex: 1, fontSize: 16, fontWeight: "800", color: "#111827", marginRight: 8 },

  countChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  countText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },

  owner: { marginTop: 2, color: "#111827", fontSize: 12, fontWeight: "700" },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  people: { flexDirection: "row", alignItems: "center" },
  metaText: { color: "#374151", fontSize: 12, fontWeight: "700" },

  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { color: "#fff", fontWeight: "800", fontSize: 12, letterSpacing: 0.2 },

  note: { marginTop: 6, color: "#4B5563", fontSize: 14 },
});
