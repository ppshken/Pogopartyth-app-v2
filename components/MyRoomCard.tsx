import React, { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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

const pad2 = (n: number) => n.toString().padStart(2, "0");
export function parseStart(s: string): Date {
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date(s) : d;
}

function useCountdown(start: string) {
  const target = React.useMemo(() => parseStart(start).getTime(), [start]);
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
  let label = "";
  if (hh > 0) label = `เหลือ ${hh} ชม. ${pad2(mm)} นาที ${pad2(ss)} วินาที`;
  else if (mm > 0) label = `เหลือ ${mm} นาที ${pad2(ss)} วินาที`;
  else label = `เหลือ ${ss} วินาที`;
  return { expired: false, label };
}

export function MyRoomCard({
  room,
  onPress,
}: {
  room: MyRoom;
  onPress?: () => void;
}) {
  const { label, expired } = useCountdown(room.start_time);
  const isFull =
    room.is_full ?? (room.current_members ?? 0) >= room.max_members;
  const statusBg =
    room.status === "invited"
      ? "#2563EB"
      : expired
      ? "#9CA3AF"
      : isFull
      ? "#EF4444"
      : room.status === "active"
      ? "#10B981"
      : "#111827";
  const statusText =
    room.status === "invited"
      ? "เชิญแล้ว"
      : expired
      ? "หมดเวลา"
      : isFull
      ? "เต็ม"
      : room.status === "active"
      ? "เปิดรับ"
      : room.status;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Image source={{ uri: room.pokemon_image }} style={styles.thumb} />
      <View style={{ flex: 1 }}>
        <View style={styles.topRow}>
          <Text numberOfLines={1} style={styles.title}>
            {room.boss}
          </Text>
          <View style={[styles.badge, { backgroundColor: statusBg }]}>
            <Text style={styles.badgeText}>{statusText}</Text>
          </View>
        </View>

        {room.owner?.username ? (
          <Text numberOfLines={1} style={styles.subtle}>
            หัวห้อง: {room.owner.username}
          </Text>
        ) : null}

        <View style={styles.metaRow}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <View style={styles.chipDark}>
              <Ionicons
                name="time-outline"
                size={14}
                color="#fff"
                style={{ marginRight: 4 }}
              />
              <Text style={styles.chipDarkText}>{label}</Text>
            </View>
            {room.status === "invited" && (
              <View style={styles.chipDark_Wait_review}>
                <Ionicons
                  name="flag-outline"
                  size={14}
                  color="#fff"
                  style={{ marginRight: 4 }}
                />
                <Text style={styles.chipDarkText}>รอรีวิว</Text>
              </View>
            )}
          </View>

          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Ionicons name="people-outline" size={16} color="#374151" />
            <Text style={styles.metaText}>
              {" "}
              {room.current_members ?? "-"} / {room.max_members}
            </Text>
          </View>
        </View>

        {room.note ? (
          <Text numberOfLines={2} style={styles.note}>
            {room.note}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 12,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
  },
  topRow: { flexDirection: "row", alignItems: "center" },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  subtle: { marginTop: 2, color: "#6B7280", fontSize: 12 },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    justifyContent: "space-between",
  },
  metaText: { color: "#374151", fontSize: 12 },

  chipDark: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#111827",
    flexDirection: "row",
    alignItems: "center",
  },
  chipDarkText: { color: "#fff", fontWeight: "700", fontSize: 12 },

  note: { marginTop: 6, color: "#4B5563", fontSize: 12 },

  chipDark_Wait_review: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: "#10B981",
    flexDirection: "row",
    alignItems: "center",
  },
});
