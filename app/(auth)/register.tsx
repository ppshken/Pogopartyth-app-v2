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
import { sendEmailOtp } from "../../lib/otp"; // ⬅️ มีไว้จะส่ง OTP ต่อได้ (ถ้ายังไม่มี คอมเมนต์บรรทัดนี้ทิ้งก่อนได้)

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
  const [trainerName, setTrainerName] = useState(""); // = username
  const [friendCode, setFriendCode] = useState("");   // = friend_code (ส่งแบบไม่มีช่องว่าง)
  const [level, setLevel] = useState("");

  // สถานะ
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(true); // กล่องยอมรับเงื่อนไข (ตั้ง true ไว้ก่อนก็ได้)
  const router = useRouter();

  // ตรวจรูปแบบ
  const emailOk = useMemo(() => /\S+@\S+\.\S+/.test(email.trim()), [email]);
  const pwOk = useMemo(() => password.trim().length >= 6, [password]);
  const nameOk = useMemo(() => trainerName.trim().length >= 2, [trainerName]);
  const codeOk = useMemo(
    () => friendCode.replace(/\s/g, "").length === 12,
    [friendCode]
  );
  const levelOk = useMemo(() => {
    const n = Number(level);
    return Number.isInteger(n) && n >= 1 && n <= 50;
  }, [level]);

  const canSubmit = emailOk && pwOk && nameOk && codeOk && levelOk && agreed && !loading;

  // รับเฉพาะตัวเลข สูงสุด 2 หลัก และคงอยู่ในช่วง 1–50
  const handleLevelChange = (t: string) => {
    const digits = t.replace(/\D/g, "").slice(0, 2);
    if (!digits) return setLevel("");
    const n = parseInt(digits, 10);
    if (isNaN(n) || n < 1) return setLevel("");
    if (n > 50) return setLevel("50");
    setLevel(String(n));
  };

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

      // ส่ง OTP ไปอีเมลเพื่อยืนยัน (ถ้ามี lib/otp)
      try {
        await sendEmailOtp();
        showSnack({ text: "สมัครสำเร็จ • ส่งรหัสยืนยันไปที่อีเมลแล้ว", variant: "success" });
        // ไปหน้ากรอก OTP (ถ้าคุณใช้ไฟล์ EmailOtpVerifyScreen ตามที่ให้ไป)
        router.replace({
          pathname: "/(auth)/EmailOtpVerifyScreen",
          params: { email: user?.email ?? email.trim() },
        });
      } catch {
        // ถ้าไม่มี endpoint/ฟังก์ชัน ส่ง OTP ก็กลับไปหน้า Login ตามเดิม
        showSnack({ text: "สมัครสำเร็จ", variant: "success" });
        router.replace("/(auth)/login");
      }
    } catch (e: any) {
      showSnack({ text: e?.message || "สมัครไม่สำเร็จ", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.centerContainer}>
          <View style={styles.wrap}>

            {/* บัญชี */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>บัญชี</Text>

              <Text style={styles.label}>อีเมล</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color={COLORS.mute} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="your@email.com"
                  placeholderTextColor={COLORS.placeholder}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                  returnKeyType="next"
                />
              </View>
              {!emailOk && !!email && <Text style={styles.hintError}>รูปแบบอีเมลไม่ถูกต้อง</Text>}

              <Text style={[styles.label, { marginTop: 12 }]}>รหัสผ่าน</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={COLORS.mute} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="อย่างน้อย 6 ตัวอักษร"
                  placeholderTextColor={COLORS.placeholder}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  style={styles.input}
                  returnKeyType="done"
                />
                <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={12}>
                  <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color={COLORS.mute} />
                </TouchableOpacity>
              </View>
              {!pwOk && !!password && <Text style={styles.hintError}>รหัสผ่านต้องยาวอย่างน้อย 6 ตัวอักษร</Text>}
            </View>

            {/* ผู้เล่น */}
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>ข้อมูลผู้เล่น</Text>

              <Text style={styles.label}>ชื่อตัวละคร</Text>
              <View style={styles.inputRow}>
                <Ionicons name="shield-outline" size={18} color={COLORS.mute} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="ชื่อในเกม"
                  placeholderTextColor={COLORS.placeholder}
                  value={trainerName}
                  onChangeText={setTrainerName}
                  style={styles.input}
                  returnKeyType="next"
                />
              </View>
              {!nameOk && !!trainerName && <Text style={styles.hintError}>อย่างน้อย 2 อักษร</Text>}

              <Text style={[styles.label, { marginTop: 12 }]}>รหัสเพิ่มเพื่อน</Text>
              <View style={styles.inputRow}>
                <Ionicons name="key-outline" size={18} color={COLORS.mute} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="XXXX XXXX XXXX"
                  placeholderTextColor={COLORS.placeholder}
                  value={friendCode}
                  onChangeText={(t) => setFriendCode(formatFriendCode(t))}
                  keyboardType="number-pad"
                  maxLength={14} // 12 ตัวเลข + 2 ช่องว่าง
                  style={styles.input}
                />
              </View>
              {!codeOk && !!friendCode && <Text style={styles.hintError}>ต้องมี 12 ตัวเลข</Text>}

              <Text style={[styles.label, { marginTop: 12 }]}>เลเวล</Text>
              <View style={styles.inputRow}>
                <Ionicons name="bookmark-outline" size={18} color={COLORS.mute} style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="1–50"
                  placeholderTextColor={COLORS.placeholder}
                  value={level}
                  onChangeText={handleLevelChange}
                  keyboardType="number-pad"
                  maxLength={2}
                  style={styles.input}
                />
              </View>
              {!levelOk && !!level && <Text style={styles.hintError}>กรอก 1–50</Text>}
            </View>

            {/* ยอมรับเงื่อนไข */}
            <TouchableOpacity
              onPress={() => setAgreed((v) => !v)}
              style={styles.agreeRow}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
              </View>
              <Text style={styles.agreeText}>
                ฉันยอมรับ <Text style={styles.link}>ข้อตกลงการใช้งาน</Text> และ{" "}
                <Text style={styles.link}>นโยบายความเป็นส่วนตัว</Text>
              </Text>
            </TouchableOpacity>

            {/* ปุ่มสมัคร */}
            <TouchableOpacity
              onPress={onRegister}
              disabled={!canSubmit}
              activeOpacity={0.9}
              style={[styles.primaryBtn, styles.btnPrimary]}
            >
              <View style={styles.primaryBtnInner}>
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={styles.primaryBtnText}>สมัครสมาชิก</Text>
                  </>
                )}
              </View>
            </TouchableOpacity>

            {/* ลิงก์ไปหน้า Login */}
            <View style={styles.bottomRow}>
              <Text style={{ color: COLORS.sub }}>มีบัญชีอยู่แล้ว?</Text>
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

/* ---- สไตล์โทนมินิมอลหรู ---- */
const COLORS = {
  bg: "#F6F7F9",
  card: "#FFFFFF",
  text: "#0F172A",
  sub: "#6B7280",
  border: "#E5E7EB",
  mute: "#9CA3AF",
  placeholder: "#9CA3AF",
  primary: "#111827",
};

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

  hero: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    alignItems: "flex-start",
    gap: 8,
    shadowColor: "rgba(16,24,40,0.06)",
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  subtitle: { color: COLORS.sub },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: COLORS.text,
    marginBottom: 12,
  },
  label: { color: COLORS.text, fontWeight: "700", marginBottom: 6 },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#FAFAFA",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: { flex: 1, color: COLORS.text },

  hintError: {
    color: "#DC2626",
    fontSize: 12,
    marginTop: 6,
    fontWeight: "700",
  },

  agreeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 2,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  checkboxChecked: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  agreeText: { color: COLORS.sub, flex: 1, lineHeight: 18 },

  primaryBtn: {
    borderRadius: 12,
    overflow: "hidden",
  },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnDisabled: { backgroundColor: "#CBD5E1" },
  primaryBtnInner: {
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.2,
  },

  bottomRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  link: {
    color: COLORS.primary,
    textDecorationLine: "underline",
    fontWeight: "900",
    marginLeft: 4,
  },
});
