import React, {
  useCallback,
  useEffect,
  useState,
  useLayoutEffect,
} from "react";
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
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { getFriendProfile } from "../../lib/user"; // ⬅️ API โปรไฟล์ (อยู่ด้านล่างคำตอบ)
import { showSnack } from "../../components/Snackbar";
import { useRouter, useNavigation } from "expo-router";
import { useLocalSearchParams } from "expo-router";
import { AddFriend, AcceptFriend } from "../../lib/friend";
import { createReport } from "../../lib/reports";

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
};

type RatingOwner = {
  avg: number | null;
  count: number;
};

type StatusFriend = {
  friendship_id: number;
  requester_id?: number;
  status: string;
};

export default function Profile() {
  const navigation = useNavigation();
  const router = useRouter();

  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);

  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<FullUser | null>(null);
  const [rat, setRat] = useState<RatingOwner | null>(null);
  const [statusFriend, setStatusFriend] = useState<StatusFriend | null>(null);

  const [reason, setReason] = useState("");

  const [is_me_addressee, setIs_me_addressee] = useState(false);

  const [onAccepted, setOnAccepted] = useState(false);
  const [onReport, setOnReport] = useState(false);

  // ภายใน component เดิมของคุณ
  const [acting, setActing] = useState(false); // กันกดซ้ำระหว่างยิง API

  // ตั้งปุ่ม help icon ที่มุมขวาบน
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setOnReport(true)}
          style={{ paddingHorizontal: 12, paddingVertical: 6 }}
          accessibilityRole="button"
          accessibilityLabel="รายงานผู้ใช้งาน"
        >
          <Ionicons
            name="information-circle-outline"
            size={22}
            color="#111827"
          />
        </TouchableOpacity>
      ),
    });
  }, [navigation]);

  // โหลดข้อมูลเพื่อน
  const load = useCallback(async () => {
    try {
      setLoading(true);
      const { user, rating_owner, status_friend, is_me_addressee } =
        await getFriendProfile(userId);
      setUser(user as FullUser);
      setRat(rating_owner as RatingOwner);
      setStatusFriend(status_friend as StatusFriend);
      setIs_me_addressee(is_me_addressee);
    } catch (e) {
      Alert.alert("โหลดโปรไฟล์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  // โหลดครั้งแรก + ตั้งชื่อหัวห้อง = ชื่อโปรไฟล์
  useEffect(() => {
    load();
  }, [load]);

  // เพิ่มเพื่อน
  const addfriend = async () => {
    if (acting) return; // กันกดรัวๆ
    try {
      setActing(true);
      const { message } = await AddFriend(userId);
      showSnack({ text: message, variant: "success" });
      await load(); // รีโหลดสถานะโปรไฟล์/เพื่อน
    } catch (e: any) {
      // แสดงข้อความจาก server เช่น "เป็นเพื่อนกันอยู่แล้ว", "อีกฝ่ายส่งคำขอมาแล้ว กรุณากดตอบรับ"
      showSnack({
        text: e?.message || "ส่งคำขอเป็นเพื่อนไม่สำเร็จ",
        variant: "error",
      });
    } finally {
      setActing(false);
    }
  };

  // กด "รับเพื่อน"
  const acceptFriend = async () => {
    if (acting) return;
    try {
      setActing(true);
      const { message } = await AcceptFriend(userId); // userId = โปรไฟล์ที่กำลังดู (เป็น requester)
      setOnAccepted(false);
      showSnack({ text: message, variant: "success" });
      await load(); // รีเฟรชสถานะโปรไฟล์
    } catch (e: any) {
      showSnack({
        text: e?.message || "ตอบรับคำขอไม่สำเร็จ",
        variant: "error",
      });
    } finally {
      setActing(false);
      setOnAccepted(false);
    }
  };

  // ส่งรายงานปัญหา
  const onSubmit = async () => {
    const trimmed = reason.trim();

    if (trimmed.length < 5) {
      Alert.alert("กรุณากรอกรายละเอียด", "กรุณาใส่ข้อความอย่างน้อย 5 ตัวอักษร");
      return;
    }
    if (trimmed.length > 2000) {
      Alert.alert("ข้อความยาวเกินไป", "กรุณาลดข้อความให้ไม่เกิน 2000 ตัวอักษร");
      return;
    }

    try {
      setLoading(true);

      const res = await createReport({
        report_type: "user",
        target_id: userId,
        reason: trimmed,
      });

      // เคสคูลดาวน์ (429 จาก backend)
      if (res.statusCode === 429) {
        const waitSec = res.data?.cooldown_sec ?? null;
        const hint =
          waitSec != null
            ? `คุณเพิ่งส่งรายงานไปแล้ว โปรดลองใหม่ใน ${waitSec} วินาที`
            : res.message || "คุณส่งถี่เกินไป โปรดลองใหม่อีกครั้งภายหลัง";

        showSnack({
          text: hint,
          variant: "warning",
          duration: 4000,
        });
        return;
      }

      // error อื่น ๆ (422, 500 etc.)
      if (!res.success) {
        Alert.alert("ไม่สำเร็จ", res.message || "ลองใหม่อีกครั้ง");
        return;
      }

      // สำเร็จ
      showSnack({
        text: "ส่งรายงานสำเร็จ ขอบคุณสำหรับความคิดเห็น!",
        variant: "success",
      });
      setReason("");
      setOnReport(false);
    } catch (e: any) {
      Alert.alert("เกิดข้อผิดพลาด", e?.message || "ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };

  // Copy รหัสเพิ่มเพื่อน
  const onCopyFriendCode = async () => {
    if (!user?.friend_code) {
      showSnack({ text: "ยังไม่ได้ตั้ง Friend Code", variant: "error" });
      return;
    }
    await Clipboard.setStringAsync(user.friend_code);
    showSnack({ text: "คัดลอก Friend Code เรียบร้อย", variant: "info" });
  };

  // เปิดแชท
  const openChat = async () => {
    router.push({
      pathname: `/friends/chat`,
      params: {
        friendshipId: String(statusFriend?.friendship_id),
        other_user_id: String(user?.id),
        other_username: user?.username,
        other_avatar: user?.avatar,
      },
    });
  };

  const teamColors: Record<string, string> = {
    Mystic: "#3B82F6",
    Valor: "#EF4444",
    Instinct: "#e6ae21ff",
  };

  const status_friend_text =
    statusFriend?.status === "pending"
      ? "ส่งคำขอแล้ว"
      : statusFriend?.status === "accepted"
      ? "เป็นเพื่อนแล้ว"
      : "เพิ่มเพื่อน";

  const status_friend_color =
    statusFriend?.status === "pending"
      ? "#697184ff"
      : statusFriend?.status === "accepted"
      ? "#10B981"
      : "#111827";

  const status_friend_icon =
    statusFriend?.status === "pending"
      ? "ellipsis-horizontal-outline"
      : statusFriend?.status === "accepted"
      ? "shield-checkmark-outline"
      : "person-add-outline";

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
            {user?.username || "ไม่ระบุชื่อ"} - {statusFriend?.friendship_id}
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
            {user?.trainer_name ? (
              <View style={styles.badgeMuted}>
                <Ionicons name="ribbon-outline" size={14} color="#111827" />
                <Text style={styles.badgeMutedText}>
                  {"  "}
                  {user.trainer_name}
                </Text>
              </View>
            ) : null}

            {/* ปุ่มจัดการเพื่อน*/}
            {is_me_addressee && statusFriend?.status === "pending" ? (
              <TouchableOpacity
                style={[styles.outlineBtnAdd, { backgroundColor: "#3B82F6" }]}
                onPress={() => {
                  setOnAccepted(true);
                }}
              >
                {acting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={16} color="#ffffffff" />
                    <Text style={styles.outlineBtnAddText}>ยอมรับ</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[
                  styles.outlineBtnAdd,
                  { backgroundColor: status_friend_color },
                ]}
                onPress={addfriend}
                disabled={
                  statusFriend?.status === "pending" ||
                  statusFriend?.status === "accepted"
                }
              >
                {acting ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Ionicons
                      name={status_friend_icon}
                      size={16}
                      color="#ffffffff"
                    />
                    <Text style={styles.outlineBtnAddText}>
                      {status_friend_text}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
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

        {/* Team ทีม */}
        <View style={styles.row}>
          <Ionicons name="cube-outline" size={18} color="#374151" />
          <Text style={styles.rowText}>ทีม</Text>
          <View style={{ flex: 1 }} />
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: teamColors[user?.team ?? ""] ?? "#E5E7EB",
              paddingHorizontal: 8,
              paddingVertical: 2,
              borderRadius: 4,
            }}
          >
            <Text style={[styles.rowValue, { color: "#ffffffff" }]}>
              {user?.team || "-"}
            </Text>
          </View>
        </View>

        {/* ปุ่มการทำงาน */}
        <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
          {/* ปุ่มแชท */}
          <TouchableOpacity
            style={[
              styles.outlinechatBtn,
              { opacity: !statusFriend?.friendship_id ? 0.5 : 1 },
            ]}
            onPress={openChat}
            disabled={!statusFriend?.friendship_id}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={16}
              color="#ffffffff"
            />
            <Text style={styles.outlinechatBtnText}>แชท</Text>
          </TouchableOpacity>

          {/* ปุ่มคัดลอกรหัสเพิ่มเพื่อน */}
          <TouchableOpacity
            style={styles.outlineBtn}
            onPress={onCopyFriendCode}
          >
            <Ionicons name="copy-outline" size={16} color="#111827" />
            <Text style={styles.outlineBtnText}>คัดลอกรหัส</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Modal: ยืนยันการรับเพื่อน */}
      <Modal
        visible={onAccepted}
        transparent
        animationType="fade"
        onRequestClose={() => setOnAccepted(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>ต้องการรับเพื่อน ?</Text>
            <TouchableOpacity
              onPress={acceptFriend}
              style={[styles.modalBtn, { backgroundColor: "#3B82F6" }]}
            >
              {acting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalBtnText}>ยืนยัน</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setOnAccepted(false)}
              style={[styles.modalBtn, styles.modalCancel]}
            >
              <Text style={[styles.modalBtnText, { color: "#111827" }]}>
                ยกเลิก
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: ยืนยันการรับเพื่อน */}
      <Modal
        visible={onReport}
        transparent
        animationType="fade"
        onRequestClose={() => setOnReport(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
            }}
          >
            <View style={styles.modalCard}>
              <Text style={styles.title}>รายงานผู้ใช้งาน</Text>
              <Text style={styles.desc}>
                กรุณาอธิบายปัญหาหรือความคิดเห็นของคุณให้ละเอียด
                เพื่อให้ทีมงานตรวจสอบและปรับปรุงระบบได้ตรงจุด
              </Text>

              <TextInput
                style={styles.input}
                placeholder="พิมพ์รายละเอียดที่นี่..."
                placeholderTextColor="#9CA3AF"
                multiline
                value={reason}
                onChangeText={setReason}
                maxLength={2000}
                editable={!loading}
              />

              <Text style={styles.note}>
                หมายเหตุ: การรายงานนี้จะถูกเก็บไว้ในระบบเพื่อการตรวจสอบ
                ไม่สามารถแก้ไขภายหลังได้
              </Text>

              <TouchableOpacity
                style={[styles.submitBtn, loading && { opacity: 0.6 }]}
                onPress={onSubmit}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.submitText}>ส่งรายงาน</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setOnReport(false)}
                style={[styles.modalBtn, styles.modalCancel]}
              >
                <Text style={[styles.modalBtnText, { color: "#111827" }]}>
                  ยกเลิก
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screenTitle: {
    fontSize: 22,
    fontFamily: "KanitSemiBold",
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
  avatarLetter: { fontSize: 28, fontFamily: "KanitSemiBold", color: "#374151" },

  name: {
    fontSize: 18,
    fontFamily: "KanitSemiBold",
    color: "#111827",
    textAlign: "center",
  },

  badgeDark: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  badgeDarkText: {
    fontSize: 14,
    fontFamily: "KanitMedium",
    color: "#ffffffff",
  },

  badgeMuted: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  badgeMutedText: {
    color: "#111827",
    fontSize: 12,
    fontFamily: "KanitSemiBold",
  },

  cardTitle: {
    fontSize: 16,
    fontFamily: "KanitSemiBold",
    color: "#111827",
    marginBottom: 8,
  },

  row: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  rowText: {
    marginLeft: 8,
    color: "#374151",
    fontSize: 14,
    fontFamily: "KanitMedium",
  },
  rowValue: { color: "#111827", fontFamily: "KanitSemiBold" },

  outlineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#111827",
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#fff",
  },
  outlineBtnText: {
    color: "#111827",
    fontFamily: "KanitSemiBold",
    fontSize: 14,
  },
  outlinechatBtn: {
    flex: 1,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#111827",
  },
  outlinechatBtnText: {
    color: "#ffffffff",
    fontFamily: "KanitSemiBold",
    fontSize: 14,
  },

  outlineBtnAdd: {
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  outlineBtnAddText: {
    color: "#ffffffff",
    fontFamily: "KanitSemiBold",
    fontSize: 14,
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
  primaryBtnText: { color: "#fff", fontFamily: "KanitSemiBold", marginLeft: 6 },
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

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: "KanitSemiBold",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
  },
  modalBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  modalBtnText: { color: "#fff", fontFamily: "KanitSemiBold", fontSize: 14 },
  modalCancel: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  title: {
    fontSize: 20,
    fontFamily: "KanitSemiBold",
    color: "#111827",
    marginBottom: 16,
    alignSelf: "center",
  },
  desc: {
    color: "#6B7280",
    marginTop: 2,
    fontSize: 14,
    fontFamily: "KanitMedium",
  },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    textAlignVertical: "top",
    minHeight: 150,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 8,
    fontFamily: "KanitMedium",
  },
  note: {
    color: "#6B7280",
    marginTop: 12,
    fontSize: 14,
    fontFamily: "KanitMedium",
  },
  submitBtn: {
    backgroundColor: "#2563EB",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  submitText: {
    color: "#fff",
    fontFamily: "KanitSemiBold",
    fontSize: 14,
  },
});
