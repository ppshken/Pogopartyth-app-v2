// app/(auth)/register.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { register as registerApi } from "../../lib/auth";
import { useAuth } from "../../store/authStore";
import { showSnack } from "../..//components/Snackbar";

function formatFriendCode(v: string) {
  const digits = v.replace(/\D/g, "").slice(0, 12);
  return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim(); // XXXX XXXX XXXX
}

export default function Register() {
  // บัญชี
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // ผู้เล่น
  const [trainerName, setTrainerName] = useState(""); // จะส่งเป็น username
  const [friendCode, setFriendCode] = useState(""); // จะส่งเป็น friend_code (ตัดช่องว่างก่อนส่ง)
  const [level, setLevel] = useState("");

  // helper: รับเฉพาะตัวเลข สูงสุด 2 หลัก และคงอยู่ในช่วง 1–50
  const handleLevelChange = (t: string) => {
    const digits = t.replace(/\D/g, "").slice(0, 2); // สูงสุด 2 ตัว
    if (!digits) return setLevel(""); // ว่างได้ตอนพิมพ์
    const n = parseInt(digits, 10);
    if (isNaN(n) || n < 1) return setLevel("");
    if (n > 50) return setLevel("50");
    setLevel(String(n)); // ตัด 01 -> 1
  };

  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const setAuth = useAuth((s) => s.setAuth);

  const emailOk = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);
  const pwOk = useMemo(() => password.trim().length >= 4, [password]);
  const nameOk = useMemo(() => trainerName.trim().length >= 2, [trainerName]);
  const codeOk = useMemo(
    () => friendCode.replace(/\s/g, "").length === 12,
    [friendCode]
  );
  const levelOk = useMemo(() => {
    const n = Number(level);
    return Number.isInteger(n) && n >= 1 && n <= 50;
  }, [level]);

  const canSubmit = emailOk && pwOk && nameOk && codeOk && levelOk && !loading;

  const onRegister = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const payload = {
        email: email.trim(),
        username: trainerName.trim(),
        password: password.trim(),
        friend_code: friendCode.replace(/\s/g, ""),
        level: Number(level),
      };
      const { user, token } = await registerApi(payload);
      await setAuth(user, token);
      showSnack({ text: "สมัครสมาชิกสำเร็จ", variant: "success" });
      router.replace("/room_raid");
    } catch (e: any) {
      showSnack({ text: e.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F3F4F6" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.centerContainer}
        >
          <View style={styles.wrap}>
            {/* Header มินิมอล */}
            <View style={styles.headerCard}>
              <View style={styles.headerIcon}>
                <Ionicons name="person-add-outline" size={22} color="#111827" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.title}>PogoPartyTH</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>สมัครสมาชิก</Text>
                  </View>
                </View>
                <View style={styles.lineRow}>
                  <Ionicons
                    name="information-circle-outline"
                    size={16}
                    color="#374151"
                  />
                  <Text style={styles.lineText}>
                    สร้างบัญชีและเริ่มเข้าร่วมเรด
                  </Text>
                </View>
              </View>
            </View>

            {/* ส่วนที่ 1: บัญชี */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>บัญชี</Text>

              <Text style={styles.label}>อีเมล</Text>
              <View style={styles.inputRow}>
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color="#6B7280"
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  placeholder="your@email.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                  returnKeyType="next"
                />
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>รหัสผ่าน</Text>
              <View style={styles.inputRow}>
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color="#6B7280"
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  style={styles.input}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  onPress={() => setShowPw((v) => !v)}
                  hitSlop={12}
                >
                  <Ionicons
                    name={showPw ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* ส่วนที่ 2: ข้อมูลผู้เล่น */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>ข้อมูลผู้เล่น</Text>

              <Text style={styles.label}>ชื่อตัวละคร</Text>
              <View style={styles.inputRow}>
                <Ionicons
                  name="shield-outline"
                  size={18}
                  color="#6B7280"
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  placeholder="ชื่อในเกม"
                  placeholderTextColor="#9CA3AF"
                  value={trainerName}
                  onChangeText={setTrainerName}
                  style={styles.input}
                  returnKeyType="next"
                />
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>
                รหัสเพิ่มเพื่อน
              </Text>
              <View style={styles.inputRow}>
                <Ionicons
                  name="key-outline"
                  size={18}
                  color="#6B7280"
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  placeholder="XXXX XXXX XXXX"
                  placeholderTextColor="#9CA3AF"
                  value={friendCode}
                  onChangeText={(t) => setFriendCode(formatFriendCode(t))}
                  keyboardType="number-pad"
                  maxLength={14} // 12 ตัวเลข + 2 ช่องว่าง
                  style={styles.input}
                />
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>เลเวล</Text>
              <View style={styles.inputRow}>
                <Ionicons
                  name="bookmark-outline"
                  size={18}
                  color="#6B7280"
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  placeholder="1-50"
                  placeholderTextColor="#9CA3AF"
                  value={level}
                  onChangeText={handleLevelChange}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={styles.input}
                />
              </View>
            </View>

            {/* ปุ่มสมัคร */}
            <TouchableOpacity
              onPress={onRegister}
              disabled={!canSubmit}
              activeOpacity={0.9}
              style={[styles.primaryBtn, { backgroundColor: "#111827" }]}
            >
              <View style={styles.primaryBtnInner}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name="person-add-outline"
                      size={18}
                      color="#fff"
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.primaryBtnText}>สมัครสมาชิก</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>

            {/* ลิงก์ไปหน้า Login */}
            <View style={styles.bottomRow}>
              <Text style={{ color: "#6B7280" }}>มีบัญชีอยู่แล้ว?</Text>
              <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
                <Text style={styles.link}>เข้าสู่ระบบ</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flexGrow: 1,
    padding: 16,
    alignItems: "center",
  },
  wrap: {
    width: "100%",
    maxWidth: 520,
    gap: 12,
  },

  headerCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  title: { fontSize: 20, fontWeight: "800", color: "#111827", marginRight: 8 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#111827",
    alignSelf: "flex-start",
  },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  lineRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  lineText: { color: "#374151", fontSize: 14, marginLeft: 6 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  label: { color: "#111827", fontWeight: "700", marginBottom: 6 },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: { flex: 1, color: "#111827" },

  primaryBtn: {
    borderRadius: 12,
    overflow: "hidden",
  },
  primaryBtnInner: {
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.2,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  link: {
    color: "#111827",
    textDecorationLine: "underline",
    fontWeight: "800",
    marginLeft: 8,
  },
});
