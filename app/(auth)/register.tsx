import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { register } from "../../lib/auth"; // สมมติว่ามี lib/auth.ts
import { showSnack } from "../../components/Snackbar"; // สมมติว่ามี Snackbar
import { sendEmailOtp } from "../../lib/otp";

// ===== ให้เหมือนหน้า login =====
const ACCENT = "#111827";
const BORDER = "#E5E7EB";
const CARD_BG = "#FFFFFF";
const TEXT_MAIN = "#111827";
const TEXT_SUB = "#6B7280";
const TEXT_DIM = "#374151";
const ERROR = "#DC2626";

// Type สำหรับ User ที่ได้จากการ Register (ตามที่คุณใช้ user?.id)
type User = {
  id: number;
  email: string;
  username: string;
  avatar: string | null;
  friend_code: string | null;
  level: number;
  created_at: string | null;
};

export default function Register() {
  // บัญชี
  const [email, setEmail] = useState("");

  // สถานะ
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const router = useRouter();

  // ตรวจรูปแบบ
  const emailOk = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email]
  );

  const canSubmit = emailOk && agreed && !loading; // เพิ่ม !loading

  const onRegister = async () => {
    if (!canSubmit) return;
    setLoading(true);

    // ตรวจสอบความถูกต้องของ UI อีกครั้งก่อนส่ง
    if (!emailOk) {
      showSnack({ text: "รูปแบบอีเมลไม่ถูกต้อง", variant: "error" });
      setLoading(false);
      return;
    }

    try {
      const payload = {
        email: email.trim(),
      };
      const user = await register(payload);
      console.log("user", user);
      if (!user.type) {
        const payload = {
          user_id: user.user.id,
          type: "register",
        };
        await sendEmailOtp(payload);
      }
      router.replace({
        pathname: "/(auth)/email_verify_otp",
        params: { email: email, user_id: user.user.id },
      });
    } catch (e: any) {
      showSnack({
        text: e?.message || "การสมัครสมาชิกไม่สำเร็จ",
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.centerContainer}
        >
          <View style={styles.wrap}>
            {/* การ์ด: บัญชี */}
            <View style={styles.card}>
              {/* Header / คำโปรย ให้ฟีลเดียวกับหน้า Login */}
              <View style={{ marginBottom: 30 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.title}>สร้างบัญชีใหม่</Text>
                </View>
                <View style={styles.lineRow}>
                  <Text style={styles.lineText}>
                    ลงทะเบียนเพื่อเริ่มใช้งาน PogoPartyTH
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>อีเมล</Text>
              <View style={styles.inputRow}>
                <TextInput
                  placeholder="your@example.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, { paddingVertical: 2 }]}
                  returnKeyType="done"
                />
              </View>
              {!emailOk && !!email && (
                <Text style={styles.errorText}>รูปแบบอีเมลไม่ถูกต้อง</Text>
              )}

              {/* ยอมรับเงื่อนไข */}
              <TouchableOpacity
                onPress={() => setAgreed((v) => !v)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 18,
                  gap: 10,
                  paddingHorizontal: 2,
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.checkbox,
                    agreed && { backgroundColor: ACCENT, borderColor: ACCENT },
                  ]}
                >
                  {agreed ? (
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  ) : null}
                </View>
                <Text style={styles.agreeText}>
                  ฉันยอมรับ <Text style={styles.link}>ข้อตกลงการใช้งาน</Text>{" "}
                  และ <Text style={styles.link}>นโยบายความเป็นส่วนตัว</Text>
                </Text>
              </TouchableOpacity>

              {/* ปุ่มสมัคร */}
              <TouchableOpacity
                onPress={onRegister}
                activeOpacity={0.9}
                style={[styles.primaryBtn, !canSubmit && { opacity: 0.6 }]}
                disabled={!canSubmit}
              >
                <View style={styles.primaryBtnInner}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>สมัครสมาชิก</Text>
                  )}
                </View>
              </TouchableOpacity>

              {/* ลิงก์ไปหน้า Login */}
              <View style={styles.bottomRow}>
                <Text style={{ color: TEXT_SUB, fontFamily: "KanitMedium" }}>
                  มีบัญชีอยู่แล้ว?
                </Text>
                <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
                  <Text style={styles.link}>เข้าสู่ระบบ</Text>
                </TouchableOpacity>
              </View>
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
  wrap: { width: "100%", maxWidth: 420 },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  title: {
    flex: 0,
    fontSize: 24,
    fontFamily: "KanitSemiBold",
    color: TEXT_MAIN,
    marginRight: 8,
    letterSpacing: 0.3,
  },
  lineRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6 },
  lineText: { color: TEXT_DIM, fontSize: 14, fontFamily: "KanitRegular" },

  sectionTitle: {
    fontSize: 18,
    color: TEXT_MAIN,
    marginBottom: 12,
    fontFamily: "KanitBold",
  },
  label: { color: TEXT_MAIN, fontFamily: "KanitSemiBold", marginBottom: 6 },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    color: TEXT_MAIN,
    fontSize: 15,
    fontFamily: "KanitRegular",
  },
  errorText: {
    color: ERROR,
    marginTop: 6,
    fontSize: 12,
    fontFamily: "KanitRegular",
  },

  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  agreeText: {
    color: TEXT_SUB,
    flex: 1,
    lineHeight: 18,
    fontFamily: "KanitRegular",
  },

  primaryBtn: {
    marginTop: 16,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: ACCENT,
  },
  primaryBtnInner: {
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontFamily: "KanitSemiBold",
    fontSize: 16,
    letterSpacing: 0.2,
  },

  bottomRow: {
    marginTop: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  link: {
    color: ACCENT,
    textDecorationLine: "underline",
    fontFamily: "KanitSemiBold",
    fontSize: 14,
  },
});
