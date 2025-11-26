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
import Constants from "expo-constants"; // ✅ เพิ่มเพื่อดึง Version

// ✅ Import รูปภาพรอไว้ข้างบน (Performance & Safety)
const IMG_PREMIUM_BG = require("../../assets/background_premium/background-premium.png");
const IMG_GOOGLE = require("../../assets/google-logo.png");

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
];

export default function Profile() {
  const router = useRouter();
  const authUser = useAuth((s) => s.user) as any;
  const logout = useAuth((s) => s.clear);

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<FullUser | null>(null);

  // ดึงเลขเวอร์ชันจาก app.json
  const appVersion = Constants.expoConfig?.version || "1.0.0";

  const load = useCallback(async () => {
    try {
      const { user } = await profile();
      setUser(user as FullUser);
    } catch (e: any) {
      setUser(authUser || null);
    }
  }, [authUser]);

  useEffect(() => {
    setUser(authUser || null);
    load();
  }, [authUser, load]);

  useRefetchOnFocus(load, [load]);

  const onLogout = async () => {
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
          if (loading) return;
          setLoading(true);
          try {
            await logout();
            // ✅ เปลี่ยนหน้าทันที ไม่ต้องรอ finally มา set loading false
            router.replace("/(auth)/login");
          } catch (error) {
            console.log(error);
            setLoading(false); // set false เฉพาะกรณี error (ยังอยู่หน้าเดิม)
          }
        },
      },
    ]);
  };

  if (!user || !IMG_PREMIUM_BG) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
    >
      {/* Card: User */}
      <View style={styles.card}>
        {user.plan === "premium" && (
          <View style={{ alignItems: "center" }}>
            <Image source={IMG_PREMIUM_BG} style={styles.premiumBg} />
          </View>
        )}

        <View style={{ alignItems: "center", padding: 16 }}>
          <AvatarComponent
            avatar={user.avatar}
            username={user.username}
            plan={user.plan}
            width={80}
            height={80}
            borderRadius={40}
            fontsize={14}
            iconsize={14}
          />

          <View style={{ flex: 1, marginTop: 12 }}>
            <Text
              style={[
                styles.name,
                { color: user.plan === "premium" ? "#d6d6d6ff" : "#000000" },
              ]}
              numberOfLines={1}
            >
              {user?.username || "ไม่ระบุชื่อ"}
            </Text>

            <View style={styles.emailRow}>
              {user.google_sub && (
                <Image
                  source={IMG_GOOGLE}
                  style={{ width: 18, height: 18, marginRight: 8 }}
                />
              )}
              <Text
                style={[
                  styles.email,
                  { color: user.plan === "premium" ? "#d6d6d6ff" : "#000000" },
                ]}
                numberOfLines={1}
              >
                {user?.email || "-"}
              </Text>
            </View>

            <View style={styles.badgeContainer}>
              <View style={styles.badgeDark}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={user.plan === "premium" ? "#d6d6d6ff" : "#000000"}
                />
                <Text
                  style={[
                    styles.badgeDarkText,
                    {
                      color: user.plan === "premium" ? "#d6d6d6ff" : "#000000",
                    },
                  ]}
                >
                  {" เข้าร่วมเมื่อ "}
                  {user?.created_at ? user.created_at : "—"}
                </Text>
              </View>
              {user?.trainer_name ? (
                <View style={styles.badgeMuted}>
                  <Ionicons name="ribbon-outline" size={14} color="#111827" />
                  <Text style={styles.badgeMutedText}>
                    {" "}
                    {user.trainer_name}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      {/* เมนู */}
      <View style={styles.card_stats}>
        <Text style={styles.cardTitle}>เมนู</Text>
        {menu.map((menuitem) => (
          <View style={styles.menuSection} key={menuitem.id}>
            <TouchableOpacity
              style={styles.menuItemBtn}
              onPress={() => {
                if (menuitem.router) {
                  router.push(menuitem.router as any);
                }
              }}
            >
              <View style={styles.menuItemLeft}>
                <Ionicons
                  name={menuitem.icon as any}
                  size={24}
                  color="#111827"
                />
                <Text style={styles.menuItemText}>{menuitem.menu}</Text>
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

        <View style={{ marginTop: 12 }}>
          <Text style={styles.footNote}>เวอร์ชัน {appVersion}</Text>
          <Text style={styles.footNote2}>สร้างโดย PogoParty TH</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  contentContainer: { padding: 16, paddingBottom: 24 },
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
    shadowColor: "rgba(16,24,40,0.06)",
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
    overflow: "hidden", // เพิ่มเพื่อให้ bg premium ตัดขอบตาม card
  },
  premiumBg: {
    position: "absolute",
    width: "100%",
    height: 212,
    top: 0,
    opacity: 0.9,
  },

  name: {
    fontSize: 18,
    textAlign: "center",
    fontFamily: "KanitSemiBold",
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  email: {
    fontSize: 14,
    fontFamily: "KanitRegular",
  },
  badgeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginTop: 8,
  },
  badgeDark: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  badgeDarkText: {
    fontSize: 14,
    fontFamily: "KanitMedium",
  },
  badgeMuted: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  badgeMutedText: {
    color: "#111827",
    fontSize: 12,
    fontFamily: "KanitSemiBold",
  },

  card_stats: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingTop: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    color: "#111827",
    marginBottom: 14,
    fontFamily: "KanitBold",
  },
  menuSection: {
    borderBottomWidth: 1,
    borderColor: "#F3F4F6", // สีเส้นจางลงหน่อย
  },
  menuItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 8,
  },
  menuItemLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuItemText: {
    fontSize: 14,
    fontFamily: "KanitSemiBold",
    color: "#111827",
  },

  primaryBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: {
    color: "#fff",
    marginLeft: 6,
    fontFamily: "KanitSemiBold",
  },

  footNote: {
    color: "#9CA3AF",
    fontSize: 12,
    textAlign: "center",
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
