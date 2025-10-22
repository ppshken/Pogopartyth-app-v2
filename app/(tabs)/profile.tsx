import React, { useCallback, useEffect, useState, useLayoutEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter, useNavigation } from "expo-router";
import { useAuth } from "../../store/authStore";
import { profile } from "../../lib/auth";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { showSnack } from "../../components/Snackbar";

type FullUser = {
  id: number;
  email: string;
  username: string;
  avatar?: string | null;
  friend_code?: string | null;
  team?: string | null;
  level?: number;
  trainer_name?: string | null;
  created_at?: string | null;
  noti_status: string;
};

type Stats = {
  rooms_owned: number;
  rooms_joined: number;
};

type RatingOwner = {
  avg: number | null;
  count: number;
};

export default function Profile() {
  const navigation = useNavigation();

  const router = useRouter();
  const authUser = useAuth((s) => s.user) as any; // user จาก store (อาจยังไม่มี field เสริม)
  const logout = useAuth((s) => s.clear);

  const [loading, setLoading] = useState(false);

  const [user, setUser] = useState<FullUser | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [rat, setRat] = useState<RatingOwner | null>(null);

  const load = useCallback(async () => {
    try {
      const { user, stats, rating_owner } = await profile(); // GET /api/auth/profile.php
      setUser(user as FullUser);
      setStats(stats as Stats);
      setRat((rating_owner as RatingOwner) ?? { avg: null, count: 0 });
    } catch (e: any) {
      // ถ้าเรียกไม่สำเร็จ fallback ใช้ user ใน store ไปก่อน
      setUser(authUser || null);
    }
  }, [authUser]);

  // ตั้งปุ่ม help icon ที่มุมขวาบน
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => router.push("/settings/setting-app")}
          style={{ paddingHorizontal: 12, paddingVertical: 6 }}
          accessibilityRole="button"
          accessibilityLabel="วิธีการใช้งาน"
        >
          <Ionicons name="settings-outline" size={22} color="#111827" />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  useEffect(() => {
    // เริ่มจากข้อมูลใน store ก่อน ให้ UI ไม่ว่างเปล่า
    setUser(authUser || null);
    // แล้วค่อยรีเฟรชจาก API
    load();
  }, [authUser, load]);

  useRefetchOnFocus(load, [load]);

  const onCopyFriendCode = async () => {
    if (!user?.friend_code) {
      showSnack({ text: "ยังไม่ได้ตั้ง Friend Code", variant: "error" });
      return;
    }
    await Clipboard.setStringAsync(user.friend_code);
    showSnack({ text: "คัดลอก Friend Code เรียบร้อย", variant: "info" });
  };

  const onLogout = async () => {
    try {
      Alert.alert("ยืนยัน", "คุณต้องการออกจากระบบใช่หรือไม่?", [
        {
          text: "ยกเลิก",
          style: "cancel",
          onPress: () => setLoading(false),
        },
        {
          text: "ออกจากระบบ",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            try {
              await logout();
              router.replace("/(auth)/login");
            } finally {
              setLoading(false);
            }
          },
        },
      ]);
    } catch (e) {
      setLoading(false);
    }
  };

  function formatFriendCode(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 12);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim(); // XXXX XXXX XXXX
  }

  const teamColors: Record<string, string> = {
    Mystic: "#3B82F6",
    Valor: "#EF4444",
    Instinct: "#F59E0B",
  };
  
  if (!user) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="small" color="#020202ff" />
      </View>
    );
  }

  // UI
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#F9FAFB" }}
      contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      {/* Card: User */}
      <View style={styles.card}>
        {/* Avatar */}
        {user?.avatar ? (
          <Image source={{ uri: user.avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarEmpty}>
            <Text style={styles.avatarLetter}>
              {user?.username ? user.username.charAt(0).toUpperCase() : "?"}
            </Text>
          </View>
        )}

        {/* Name + email */}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {user?.username || "ไม่ระบุชื่อ"}
          </Text>
          <Text style={styles.email} numberOfLines={1}>
            {user?.email || "-"}
          </Text>

          {/* Chips / quick actions */}
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 8,
              justifyContent: "center",
              marginTop: 8,
            }}
          >
            <View style={[styles.badgeDark]}>
              <Ionicons name="calendar-outline" size={14} color="#000000ff" />
              <Text style={styles.badgeDarkText}>
                {" เข้าร่วมเมื่อ "}
                {user?.created_at ? user.created_at : "—"}
              </Text>
            </View>
            {user?.trainer_name ? (
              <View style={styles.badgeMuted}>
                <Ionicons name="ribbon-outline" size={14} color="#111827" />
                <Text style={styles.badgeMutedText}>
                  {"  "}
                  {user.trainer_name}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>

      {/* Card: More info */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ข้อมูลเพิ่มเติม</Text>

        {/* Friend Code */}
        <View style={styles.row}>
          <Ionicons name="qr-code-outline" size={18} color="#374151" />
          <Text style={styles.rowText}>รหัสเพิ่มเพื่อน</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.rowValue}>
            {formatFriendCode(user?.friend_code || "-")}
          </Text>
        </View>

        {/* Level */}
        <View style={styles.row}>
          <Ionicons name="bookmark-outline" size={18} color="#374151" />
          <Text style={styles.rowText}>เลเวล</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.rowValue}>{user?.level || "-"}</Text>
        </View>

        {/* Rating (หัวห้อง) */}
        <View style={styles.row}>
          <Ionicons name="star-outline" size={18} color="#374151" />
          <Text style={styles.rowText}>คะแนนรีวิวที่ได้รับ</Text>
          <View style={{ flex: 1 }} />
          <Text style={styles.rowValue}>
            <Ionicons name="star" size={14} color="#FBBF24" />
            {" "}
            {rat?.avg ? `${rat.avg.toFixed(2)} (${rat.count} รีวิว)` : "ยังไม่มีรีวิว"}
          </Text>
        </View>

        {/* Team ทีม */}
        <View style={styles.row}>
          <Ionicons name="cube-outline" size={18} color="#374151" />
          <Text style={styles.rowText}>ทีม</Text>
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: teamColors [user.team ?? ""] ?? "#E5E7EB", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
            <Text style={[styles.rowValue, { color: "#ffffffff" }]}>
              {user?.team || "-"}
            </Text>
          </View>
        </View>

        {/* ปุ่มคัดลอก Friend Code กับ ห้องของฉัน */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={onCopyFriendCode}
          >
            <Ionicons name="copy-outline" size={16} color="#111827" />
            <Text style={styles.outlineBtnText}>คัดลอก รหัสเพิ่มเพื่อน</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={() => router.push("/my_raid")}
          >
            <Ionicons name="invert-mode" size={16} color="#111827" />
            <Text style={styles.outlineBtnText}>ห้องของฉัน</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* รายงาน สถิติการเข้าร่วม รีวิว */}
      <View style={styles.card_stats}>
        <Text style={styles.cardTitle}>รายงาน</Text>
        <View style={styles.cardSection}>
          <View style={styles.card_stats_detail}>
            <Ionicons name="paw-outline" size={24} />
            <Text style={{ fontSize: 14, fontFamily: "KanitSemiBold", color: "#111827" }}>
              จำนวนห้องที่สร้างทั้งหมด
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "KanitSemiBold", color: "#111827" }}>
              {stats?.rooms_owned}
            </Text>
          </View>
          <View style={styles.card_stats_detail}>
            <Ionicons name="invert-mode-outline" size={24} />
            <Text style={{ fontSize: 14, fontFamily: "KanitSemiBold", color: "#111827" }}>
              จำนวนห้องที่เข้าร่วมทั้งหมด
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "KanitSemiBold", color: "#111827" }}>
              {stats?.rooms_joined}
            </Text>
          </View>
        </View>
      </View>

      {/* Actions */}
      <View style={{ marginTop: 8 }}>
        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: "#111827" }]}
          onPress={() => router.push("/settings/profile-edit")} // สร้างหน้าแก้ไขภายหลังได้
        >
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>แก้ไขโปรไฟล์</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryBtn, { backgroundColor: "#EF4444" }]}
          onPress={onLogout}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>ออกจากระบบ</Text>
            </>
          )}
        </TouchableOpacity>
        <View>
          <Text
            style={{
              color: "#9CA3AF",
              fontSize: 12,
              textAlign: "center",
              marginTop: 12,
              fontFamily: "KanitRegular",
            }}
          >
            เวอร์ชัน 1.0.0
          </Text>
          <Text
            style={{
              color: "#9CA3AF",
              fontSize: 12,
              textAlign: "center",
              marginTop: 4,
              fontFamily: "KanitRegular",
            }}
          >
            สร้างโดย PogoParty TH
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    fontSize: 22,
    color: "#111827",
    marginBottom: 12,
    fontFamily: "KanitBold",
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 12,
    shadowColor: "rgba(16,24,40,0.06)",
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },

  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
    alignSelf: "center",
  },
  avatarEmpty: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    alignSelf: "center",
  },
  avatarLetter: { fontSize: 28, color: "#374151", fontFamily: "KanitBold" },

  name: {
    fontSize: 18,
    color: "#111827",
    textAlign: "center",
    fontFamily: "KanitSemiBold",
  },
  email: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 2,
    fontFamily: "KanitRegular",
  },

  badgeDark: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 2,
    alignSelf: "flex-start",
  },
  badgeDarkText: { fontSize: 14, fontFamily: "KanitMedium", color: "#000000ff" },

  badgeMuted: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  badgeMutedText: { color: "#111827", fontSize: 12, fontFamily: "KanitSemiBold" },

  cardTitle: {
    fontSize: 16,
    color: "#111827",
    marginBottom: 8,
    fontFamily: "KanitBold",
  },

  row: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  rowText: { marginLeft: 8, color: "#374151", fontSize: 14, fontFamily: "KanitRegular" },
  rowValue: { color: "#111827", fontFamily: "KanitSemiBold" },

  outlineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#525252ff",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
  },
  outlineBtnText: { color: "#111827", fontFamily: "KanitSemiBold" },

  primaryBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { color: "#fff", marginLeft: 6, fontFamily: "KanitBold" },

  card_stats: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 12,
  },
  cardSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    gap: 8,
  },
  card_stats_detail: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 20,
    borderRadius: 14,
    flex: 1,
    alignItems: "center",
    gap: 8,
  },

  // เพิ่มสไตล์สำหรับบล็อกสถิติ (แทน inline fontWeight)
  statLabel: { fontSize: 12, fontFamily: "KanitSemiBold", color: "#111827" },
  statNumber: { fontSize: 12, fontFamily: "KanitBold", color: "#111827" },

  // footer ข้างล่าง
  footNote: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
    fontFamily: "KanitRegular",
  },
  footNote2: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    fontFamily: "KanitRegular",
  },
});

