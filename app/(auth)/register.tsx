// app/(auth)/register.tsx
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
import { register as registerApi } from "../../lib/auth";
import { showSnack } from "../../components/Snackbar";
import { sendEmailOtp } from "../../lib/otp"; // ถ้ายังไม่มี endpoint ให้คอมเมนต์บรรทัดนี้ทิ้งได้

// ===== ให้เหมือนหน้า login =====
const ACCENT = "#111827";
const BORDER = "#E5E7EB";
const CARD_BG = "#FFFFFF";
const TEXT_MAIN = "#111827";
const TEXT_SUB = "#6B7280";
const TEXT_DIM = "#374151";
const ERROR = "#DC2626";

export default function Register() {
  // บัญชี
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  // สถานะ
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(true);

  const router = useRouter();

  // ตรวจรูปแบบ
  const emailOk = useMemo(
    () => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()),
    [email]
  );
  const pwOk = useMemo(() => password.trim().length >= 8, [password]);

  const canSubmit = emailOk && pwOk && agreed ;

  const onRegister = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const payload = {
        email: email.trim(),
        password: password.trim(),
      };
      const { user } = await registerApi(payload);

      // (ออปชัน) ส่ง OTP
      try {
        await sendEmailOtp();
        showSnack({
          text: "สมัครสำเร็จ • ส่งรหัสยืนยันไปที่อีเมลแล้ว",
          variant: "success",
        });
        router.replace({
          pathname: "/(auth)/EmailOtpVerifyScreen",
          params: { email: user?.email ?? email.trim() },
        });
      } catch {
        showSnack({ text: "สมัครสำเร็จ", variant: "success" });
        router.replace("/(auth)/email_verify_otp");
      }
    } catch (e: any) {
      showSnack({ text: e?.message || "สมัครไม่สำเร็จ", variant: "error" });
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
                  placeholder="your@email.com"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={[styles.input, { paddingVertical: 2 }]}
                  returnKeyType="next"
                />
              </View>
              {!emailOk && !!email && (
                <Text style={styles.errorText}>รูปแบบอีเมลไม่ถูกต้อง</Text>
              )}

              <Text style={[styles.label, { marginTop: 12 }]}>รหัสผ่าน</Text>
              <View style={styles.inputRow}>
                <TextInput
                  placeholder="อย่างน้อย 8 ตัวอักษร"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  style={[styles.input, { paddingVertical: 2 }]}
                  returnKeyType="done"
                />
                <TouchableOpacity
                  onPress={() => setShowPw((v) => !v)}
                  hitSlop={12}
                >
                  <Ionicons
                    name={showPw ? "eye-off-outline" : "eye-outline"}
                    size={18}
                    color={TEXT_SUB}
                  />
                </TouchableOpacity>
              </View>
              {!pwOk && !!password && (
                <Text style={styles.errorText}>
                  รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร
                </Text>
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
