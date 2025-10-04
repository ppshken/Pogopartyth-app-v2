// app/(auth)/login.tsx
import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { login } from "../../lib/auth";
import { useAuth } from "../../store/authStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { registerForPushNotificationsAsync } from "../../lib/push";


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ===== THEME =====
const ACCENT = "#111827"; // สีหลัก
const BORDER = "#E5E7EB";
const CARD_BG = "#FFFFFF";
const INPUT_BG = "#F9FAFB";
const TEXT_MAIN = "#111827";
const TEXT_SUB = "#6B7280";
const TEXT_DIM = "#374151";
const ERROR = "#DC2626";


export default function Login() {
  // ===== STATES =====
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [expoPushToken, setExpoPushToken] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const [focus, setFocus] = useState<"email" | "password" | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const router = useRouter();
  const setAuth = useAuth((s) => s.setAuth);

  const isValidEmail = (v: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

  // Push token
  useEffect(() => {
    registerForPushNotificationsAsync().then(
      (token) => token && setExpoPushToken(token)
    );
  }, []);

  // Email validate
  useEffect(() => {
    if (email.length === 0) setEmailError(null);
    else setEmailError(isValidEmail(email) ? null : "อีเมลไม่ถูกต้อง");
  }, [email]);

  const canSubmit = useMemo(
    () =>
      email.trim().length > 0 &&
      password.trim().length >= 4 &&
      !emailError &&
      !loading,
    [email, password, emailError, loading]
  );

  // ===== EMAIL/PASSWORD LOGIN =====
  const onLogin = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const { user, token } = await login({
        email: email.trim(),
        password: password.trim(),
        device_token: expoPushToken.trim(),
      });
      await setAuth(user, token);
      // debug
      console.log("token", await AsyncStorage.getItem("token"));
      router.replace("/room_raid");
    } catch (e: any) {
      Alert.alert(e?.message || "เข้าสู่ระบบไม่สำเร็จ");
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
            {/* Header card */}
            <View style={styles.headerCard}>
              <View style={styles.headerIcon}>
                <Image
                  source={require("../../assets/pogopartyth.png")}
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 12,
                    alignSelf: "center",
                  }}
                />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.title}>PogoPartyTH</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>v1</Text>
                  </View>
                </View>
                <View style={styles.lineRow}>
                  <Ionicons name="flash-outline" size={16} color={TEXT_DIM} />
                  <Text style={styles.lineText}>
                    เข้าร่วมเรดได้ไว ใช้งานง่าย
                  </Text>
                </View>
              </View>
            </View>

            {/* Form */}
            <View style={styles.card}>
              <Text style={styles.label}>อีเมล</Text>
              <View
                style={[
                  styles.inputRow,
                  focus === "email" && {
                    borderColor: ACCENT,
                    backgroundColor: "#fff",
                  },
                  emailError && { borderColor: ERROR },
                ]}
              >
                <Ionicons
                  name="mail-outline"
                  size={18}
                  color={TEXT_SUB}
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
                  onFocus={() => setFocus("email")}
                  onBlur={() => setFocus(null)}
                />
                {email.length > 0 && !emailError && (
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                )}
              </View>
              {!!emailError && (
                <Text style={styles.errorText}>{emailError}</Text>
              )}

              <Text style={[styles.label, { marginTop: 12 }]}>รหัสผ่าน</Text>
              <View
                style={[
                  styles.inputRow,
                  focus === "password" && {
                    borderColor: ACCENT,
                    backgroundColor: "#fff",
                  },
                ]}
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={18}
                  color={TEXT_SUB}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  placeholder="อย่างน้อย 4 ตัวอักษร"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPw}
                  style={styles.input}
                  returnKeyType="done"
                  onSubmitEditing={onLogin}
                  onFocus={() => setFocus("password")}
                  onBlur={() => setFocus(null)}
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

              <TouchableOpacity
                onPress={onLogin}
                activeOpacity={0.9}
                style={styles.primaryBtn}
                disabled={loading}
              >
                <View style={styles.primaryBtnInner}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name="log-in-outline"
                        size={18}
                        color="#fff"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.primaryBtnText}>เข้าสู่ระบบ</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>

              {/* Divider */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginTop: 16,
                }}
              >
                <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
                <Text
                  style={{ marginHorizontal: 8, color: TEXT_SUB, fontSize: 12 }}
                >
                  หรือ
                </Text>
                <View style={{ flex: 1, height: 1, backgroundColor: BORDER }} />
              </View>

              {/* Google Sign-In */}
              <TouchableOpacity
                
                activeOpacity={0.9}
                disabled={loadingGoogle || loading}
                style={styles.googleBtn}
              >
                <View style={styles.googleBtnInner}>
                  {loadingGoogle ? (
                    <ActivityIndicator />
                  ) : (
                    <>
                      {/* ใช้โลโก้ PNG (RN ไม่โหลด SVG จากเน็ตโดยตรง) */}
                      <Image
                        source={{
                          uri: "https://developers.google.com/identity/images/g-logo.png",
                        }}
                        style={{ width: 18, height: 18, marginRight: 8 }}
                      />
                      <Text style={styles.googleBtnText}>
                        Sign in with Google
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>

              <View style={styles.bottomRow}>
                <Text style={{ color: TEXT_SUB }}>ยังไม่มีบัญชี?</Text>
                <TouchableOpacity
                  onPress={() => router.push("/(auth)/register")}
                >
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
  // background decoration
  bgWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  blob: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 999,
    opacity: 0.2,
    transform: [{ rotate: "25deg" }],
  },
  blobTL: {
    top: -60,
    left: -60,
    backgroundColor: "#C7D2FE", // indigo-200
  },
  blobBR: {
    right: -70,
    bottom: -70,
    backgroundColor: "#FDE68A", // amber-200
  },

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
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: 14,
    marginRight: 12,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: BORDER,
  },
  title: {
    flex: 0,
    fontSize: 22,
    fontWeight: "800",
    color: TEXT_MAIN,
    marginRight: 8,
    letterSpacing: 0.3,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: ACCENT,
    alignSelf: "flex-start",
  },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  lineRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 6 },
  lineText: { color: TEXT_DIM, fontSize: 14 },

  card: {
    backgroundColor: CARD_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 8,
  },
  label: { color: TEXT_MAIN, fontWeight: "700", marginBottom: 6 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: INPUT_BG,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: { flex: 1, color: TEXT_MAIN },
  errorText: {
    color: ERROR,
    marginTop: 6,
    fontSize: 12,
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
    fontWeight: "800",
    fontSize: 16,
    letterSpacing: 0.2,
  },

  // Google button
  googleBtn: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#fff",
  },
  googleBtnInner: {
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  googleBtnText: {
    color: TEXT_MAIN,
    fontWeight: "800",
    fontSize: 15,
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
    fontWeight: "800",
  },
});
