import React, { useCallback, useEffect, useState } from "react";
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
import { useRouter } from "expo-router";
import { useAuth } from "../../store/authStore";
import { profile } from "../../lib/auth";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";
import { AvatarComponent } from "../../components/Avatar";

type FullUser = {
  id: number;
  email: string;
  username: string;
  avatar: string;
  friend_code?: string | null;
  team: string;
  level?: number;
  trainer_name?: string | null;
  created_at?: string | null;
  noti_status: string;
  google_sub: string;
  plan: string;
};

const menu = [
  {
    id: 1,
    menu: "ดูโปรไฟล์",
    icon: "person-outline",
    router: "/settings/profile",
  },
  {
    id: 2,
    menu: "ตั้งค่าโปรไฟล์",
    icon: "people-outline",
    router: "/settings/profile-edit",
  },
  {
    id: 3,
    menu: "ประวัติ",
    icon: "archive-outline",
    router: "/settings/user-log",
  },
  {
    id: 4,
    menu: "ตั้งค่าแอพ",
    icon: "settings-outline",
    router: "/settings/setting-app",
  },
  {
    id: 5,
    menu: "Feedback",
    icon: "alert-circle-outline",
    router: "/settings/feedback",
  },
  {
    id: 6,
    menu: "บัญชี",
    icon: "person-circle-outline",
    router: "",
  },
];

export default function Profile() {
  const router = useRouter();

  const authUser = useAuth((s) => s.user) as any; // user จาก store (อาจยังไม่มี field เสริม)
  const logout = useAuth((s) => s.clear);

  const [loading, setLoading] = useState(false);

  const [user, setUser] = useState<FullUser | null>(null);

  const load = useCallback(async () => {
    try {
      const { user } = await profile(); // GET /api/auth/profile.php
      setUser(user as FullUser);
    } catch (e: any) {
      // ถ้าเรียกไม่สำเร็จ fallback ใช้ user ใน store ไปก่อน
      setUser(authUser || null);
    }
  }, [authUser]);

  useEffect(() => {
    // เริ่มจากข้อมูลใน store ก่อน ให้ UI ไม่ว่างเปล่า
    setUser(authUser || null);
    // แล้วค่อยรีเฟรชจาก API
    load();
  }, [authUser, load]);

  useRefetchOnFocus(load, [load]);

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
        <AvatarComponent
          avatar={user.avatar}
          username={user.username}
          plan={user.plan}
          width={80}
          height={80}
          borderRadius={40}
          fontsize={14}
        />

        {/* Name + email */}
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {user?.username || "ไม่ระบุชื่อ"}
          </Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {user.google_sub && (
              <Image
                source={require("assets/g-logo.png")}
                style={{ width: 18, height: 18, marginRight: 8 }}
              />
            )}

            <Text style={styles.email} numberOfLines={1}>
              {user?.email || "-"}
            </Text>
          </View>

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

      {/* เมนู */}
      <View style={styles.card_stats}>
        <Text style={styles.cardTitle}>เมนู</Text>
        {menu.map((menuitem) => (
          <View style={styles.menuSection} key={menuitem.id}>
            <TouchableOpacity
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 8,
                gap: 8,
                borderBottomWidth: 1,
                borderColor: "#e4e4e4ff",
                paddingBottom: 8,
              }}
              onPress={() => {
                if (menuitem.router) {
                  router.push(menuitem.router);
                }
              }}
            >
              <View
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 12,
                  padding: 4,
                }}
              >
                <Ionicons name={menuitem.icon as any} size={24} />
                <Text
                  style={{
                    fontSize: 14,
                    fontFamily: "KanitSemiBold",
                    color: "#111827",
                  }}
                >
                  {menuitem.menu}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={12} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={{ marginTop: 8 }}>
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
  badgeDarkText: {
    fontSize: 14,
    fontFamily: "KanitMedium",
    color: "#000000ff",
  },

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
  badgeMutedText: {
    color: "#111827",
    fontSize: 12,
    fontFamily: "KanitSemiBold",
  },

  cardTitle: {
    fontSize: 18,
    color: "#111827",
    marginBottom: 14,
    fontFamily: "KanitBold",
  },

  row: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  rowText: {
    marginLeft: 8,
    color: "#374151",
    fontSize: 14,
    fontFamily: "KanitRegular",
  },
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
  primaryBtnText: { color: "#fff", marginLeft: 6, fontFamily: "KanitSemiBold" },

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
  menuSection: {
    flexDirection: "row",
    alignItems: "center",
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
