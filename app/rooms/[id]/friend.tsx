import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { getFriendProfile } from "../../../lib/user"; // ⬅️ API โปรไฟล์ (อยู่ด้านล่างคำตอบ)
import { useRefetchOnFocus } from "../../../hooks/useRefetchOnFocus";
import { showSnack } from "../../../components/Snackbar";
import { useLocalSearchParams } from "expo-router";

type FullUser = {
  id: number;
  email: string;
  username: string;
  avatar?: string | null;
  friend_code?: string | null;
  level?: number;
  trainer_name?: string | null;
  created_at?: string | null;
};

type RatingOwner = { 
  avg: number | null; 
  count: number 
};

export default function Profile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<FullUser | null>(null);
  const [rat, setRat] = useState<RatingOwner | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { user, rating_owner } = await getFriendProfile(userId);
      setUser(user as FullUser);
      setRat(rating_owner as RatingOwner);
    } catch (e) {
      Alert.alert("โหลดโปรไฟล์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useRefetchOnFocus(load, [load]);

  const onCopyFriendCode = async () => {
    if (!user?.friend_code) {
      showSnack({ text: "ยังไม่ได้ตั้ง Friend Code", variant: "error" });
      return;
    }
    await Clipboard.setStringAsync(user.friend_code);
    showSnack({ text: "คัดลอก Friend Code เรียบร้อย", variant: "info" });
  };

  function formatFriendCode(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 12);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim(); // XXXX XXXX XXXX
  }
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
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
            }}
          >
            <View style={styles.badgeDark}>
              <Ionicons name="calendar-outline" size={14} />
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
            <Ionicons name="star" size={14} color="#FBBF24" />{" "}
            {rat?.avg ? `${rat.avg.toFixed(1)} (${rat.count} รีวิว)` : "-"}
          </Text>
        </View>

        {/* ปุ่มการทำงาน */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={onCopyFriendCode}
          >
            <Ionicons name="copy-outline" size={16} color="#111827" />
            <Text style={styles.outlineBtnText}>คัดลอก รหัสเพิ่มเพื่อน</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 12,
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
  avatarLetter: { fontSize: 28, fontWeight: "800", color: "#374151" },

  name: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    textAlign: "center",
  },
  email: { fontSize: 13, color: "#6B7280", textAlign: "center", marginTop: 2 },

  badgeDark: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  badgeDarkText: { fontSize: 12, fontWeight: "700" },

  badgeMuted: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  badgeMutedText: { color: "#111827", fontSize: 12, fontWeight: "700" },

  cardTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },

  row: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  rowText: { marginLeft: 8, color: "#374151", fontSize: 14 },
  rowValue: { color: "#111827", fontWeight: "700", marginLeft: 8 },

  outlineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#111827",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
  },
  outlineBtnText: { color: "#111827", fontWeight: "800" },

  primaryBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", marginLeft: 6 },
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
});
