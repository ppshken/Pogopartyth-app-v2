import React, { useEffect, useMemo, useState } from "react";
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { TierStars } from "../components/TierStars";
import { BossImage } from "../components/ฺBossImage";

type Room = {
  id: number;
  raid_boss_id: number;
  pokemon_image: string;
  boss: string;
  special: boolean;
  boss_type: string;
  start_time: string;
  status: string;
  current_members: number;
  max_members: number;
  note?: string | null;
  min_level: number | null;
  vip_only: boolean | null;
  lock_room: boolean | null;
  password_room: string | null;
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
  if (hh > 0) label = `${hh} ชม. ${pad(mm)} นาที ${pad(ss)} วินาที`;
  else if (mm > 0) label = `${mm} นาที ${pad(ss)} วินาที`;
  else label = `${ss} วินาที`;

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

  const is_joined = room.is_joined === 1;
  const is_joinedbg = room.is_joined === 1 ? "#dde9f5ff" : "#ffffffff";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: is_joinedbg,
          borderColor: "#E5E7EB",
          opacity: isFull && !is_joined ? 0.4 : 1,
        }, // ✅ เพิ่มตรงนี้
        pressed && styles.pressed,
      ]}
      disabled={isFull && !is_joined}
    >
      {/* แสดงรูปบอส */}
      <View style={styles.thumb}>
        <BossImage
          pokemon_image={room?.pokemon_image}
          boss_type={room?.boss_type}
          width={72}
          height={72}
          borderRadius={10}
          iconheight={20}
          iconwidth={20}
        />
      </View>

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

          <View style={{ flexDirection: "row", gap: 4 }}>
            {/* เข้าร่วมแล้ว */}
            {room.is_joined === 1 && (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: "#6b3ab9ff",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  },
                ]}
              >
                <Text style={styles.statusText}>เข้าร่วมแล้ว</Text>
              </View>
            )}

            {/* เลเวลขั้นต่ำ */}
            {room.min_level && (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: "#d67547ff",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  },
                ]}
              >
                <Text style={styles.statusText}>Lv.{room.min_level}+</Text>
              </View>
            )}

            {/* เฉพาะ VIP */}
            {room.vip_only && (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: "#EFBF04",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  },
                ]}
              >
                <Text style={[styles.statusText, { color: "#666666" }]}>
                  Premium
                </Text>
              </View>
            )}

            {room.lock_room && (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: "#ebebebff",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  },
                ]}
              >
                <Ionicons name="bag" size={16} color="#3066dbff" />
              </View>
            )}

            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
          </View>
        </View>
      </View>
      {/* Special*/}
      {room.special ? (
        <View style={{ position: "absolute", top: 12, left: 0 }}>
          <View
            style={[
              styles.vipBadge,
              {
                backgroundColor: "#1bad23ff",
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              },
            ]}
          >
            <Ionicons name="paw" color="#ffffff" size={14} />
            <Text style={[styles.statusText, { color: "#ffffffff" }]}>
              Special
            </Text>
          </View>
        </View>
      ) : null}
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
    alignItems: "center",
  },
  pressed: { opacity: 0.9 },
  thumb: {
    marginRight: 12,
  },
  topRow: { flexDirection: "row", alignItems: "center" },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginRight: 8,
    fontFamily: "KanitSemiBold",
  },

  countChip: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
  },
  countText: { color: "#FFFFFF", fontSize: 12, fontFamily: "KanitMedium" },

  owner: {
    marginTop: 2,
    color: "#111827",
    fontSize: 12,
    fontFamily: "KanitMedium",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  people: { flexDirection: "row", alignItems: "center" },
  metaText: { color: "#374151", fontSize: 12, fontFamily: "KanitSemiBold" },

  statusBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  vipBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderTopRightRadius: 6,
    borderBottomRightRadius: 6,
  },
  statusText: {
    color: "#fff",
    fontSize: 12,
    letterSpacing: 0.2,
    fontFamily: "KanitMedium",
  },

  note: { marginTop: 6, color: "#4B5563", fontSize: 14 },
});
