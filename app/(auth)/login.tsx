// app/(auth)/login.tsx
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
import { login } from "../../lib/auth";
import { useAuth } from "../../store/authStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { showSnack } from "../..//components/Snackbar";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const setAuth = useAuth((s) => s.setAuth);

  const canSubmit = useMemo(
    () => email.trim().length > 0 && password.trim().length >= 4 && !loading,
    [email, password, loading]
  );


  const onLogin = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const { user, token } = await login({
        email: email.trim(),
        password: password.trim(),
      });
      await setAuth(user, token);
      
      console.log('token', await AsyncStorage.getItem('token'))
      router.replace("/room_raid"); // ปรับ path ให้ตรงโปรเจ็กต์คุณ
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
            {/* Header แบบมินิมอล */}
            <View style={styles.headerCard}>
              <View style={styles.headerIcon}>
                <Ionicons name="shield-outline" size={22} color="#111827" />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.title}>PogoPartyTH</Text>
                </View>
                <View style={styles.lineRow}>
                  <Text style={styles.lineText}>เข้าร่วมเรดได้ไว ใช้งานง่าย</Text>
                </View>
              </View>
            </View>

            {/* ฟอร์ม */}
            <View style={styles.card}>
              <Text style={styles.label}>อีเมล</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
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
                <Ionicons name="lock-closed-outline" size={18} color="#6B7280" style={{ marginRight: 8 }} />
                <TextInput
                  placeholder="อย่างน้อย 4 ตัวอักษร"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  style={styles.input}
                  returnKeyType="done"
                  onSubmitEditing={onLogin}
                />
                <TouchableOpacity onPress={() => setShowPw((v) => !v)} hitSlop={12}>
                  <Ionicons name={showPw ? "eye-off-outline" : "eye-outline"} size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={onLogin}
                disabled={!canSubmit}
                activeOpacity={0.9}
                style={[
                  styles.primaryBtn,
                  { backgroundColor: "#111827" },
                ]}
              >
                {/* ✅ ห่อทุกอย่างใน View เพื่อไม่ให้มี string หลุด */}
                <View style={styles.primaryBtnInner}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="log-in-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                      <Text style={styles.primaryBtnText}>เข้าสู่ระบบ</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>

              <View style={styles.bottomRow}>
                <Text style={{ color: "#6B7280" }}>ยังไม่มีบัญชี?</Text>
                <TouchableOpacity onPress={() => router.push("/(auth)/register")}>
                  <Text style={styles.link}>สมัครสมาชิก</Text>
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
    justifyContent: "center",
    alignItems: "center",
  },
  wrap: {
    width: "100%",
    maxWidth: 420,
  },

  headerCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 12,
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
  title: { flex: 0, fontSize: 20, fontWeight: "800", color: "#111827", marginRight: 8 },
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
    marginTop: 16,
    borderRadius: 12,
    overflow: "hidden",
  },
  primaryBtnInner: {
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", fontSize: 16, letterSpacing: 0.2 },

  bottomRow: {
    marginTop: 14,
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
