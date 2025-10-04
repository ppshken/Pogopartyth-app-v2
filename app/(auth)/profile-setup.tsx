// app/(auth)/profile-setup.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../store/authStore";

const ACCENT = "#111827";
const BORDER = "#E5E7EB";
const CARD_BG = "#FFFFFF";
const INPUT_BG = "#F9FAFB";
const TEXT_MAIN = "#111827";
const TEXT_SUB = "#6B7280";
const ERROR = "#DC2626";

const API_SET_USERNAME = "https://your.api.com/api/user/set_username.php";

export default function ProfileSetup() {
  const router = useRouter();
  const params = useLocalSearchParams() as { suggest?: string };
  const { user, token, setAuth } = useAuth((s) => ({
    user: s.user,
    token: s.token,
    setAuth: s.setAuth,
  }));

  const [username, setUsername] = useState(
    (params?.suggest || "").toLowerCase()
  );
  const [focus, setFocus] = useState<"username" | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ถ้ามี username อยู่แล้ว ไม่ควรมาหน้านี้
  useEffect(() => {
    if (user?.username) {
      router.replace("/room_raid");
    }
  }, [user?.username]);

  const validFormat = useMemo(
    () => /^[a-z0-9_]{3,20}$/.test(username.trim()),
    [username]
  );

  const canSubmit = useMemo(
    () => validFormat && !loading && username.trim().length > 0,
    [validFormat, loading, username]
  );

  const onSubmit = async () => {
    if (!canSubmit) {
      if (!validFormat) {
        setErr("ต้องเป็น a-z, 0-9, _ ยาว 3–20 ตัว");
      }
      return;
    }

    try {
      setLoading(true);
      setErr(null);

      const res = await fetch(API_SET_USERNAME, {
        method: "POST", // หรือ "PATCH" ตามที่คุณตั้งค่าไว้
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // authGuard() ฝั่ง PHP จะอ่านจาก JWT
        },
        body: JSON.stringify({ username: username.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.success) {
        if (res.status === 409) {
          setErr("username นี้ถูกใช้แล้ว");
        } else if (res.status === 422) {
          setErr(data?.message || "รูปแบบไม่ถูกต้อง");
        } else {
          setErr(data?.message || "บันทึกไม่สำเร็จ");
        }
        return;
      }

      // อัปเดต store (อย่างน้อยเติม username ให้ user ปัจจุบัน)
      setAuth(
        { ...(user || {}), username: username.trim() } as any,
        token as string
      );

      // เข้าโฮม
      router.replace("/room_raid");
    } catch (e: any) {
      setErr(e?.message || "เกิดข้อผิดพลาด");
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
            <View style={styles.card}>
              <Text style={styles.title}>ตั้งค่าโปรไฟล์</Text>
              <Text style={styles.subtitle}>
                เลือกชื่อผู้ใช้ (username) เพื่อแสดงในแอป
              </Text>

              <Text style={[styles.label, { marginTop: 12 }]}>Username</Text>
              <View
                style={[
                  styles.inputRow,
                  focus === "username" && {
                    borderColor: ACCENT,
                    backgroundColor: "#fff",
                  },
                  err && { borderColor: ERROR },
                ]}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={18}
                  color={TEXT_SUB}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  value={username}
                  onChangeText={(t) => {
                    setUsername(t.toLowerCase());
                    setErr(null);
                  }}
                  placeholder="เช่น pokotrainer_99"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  style={styles.input}
                  onFocus={() => setFocus("username")}
                  onBlur={() => setFocus(null)}
                  returnKeyType="done"
                  onSubmitEditing={onSubmit}
                />
                {validFormat && username.length >= 3 && (
                  <Ionicons
                    name="checkmark-circle"
                    size={18}
                    color="#10B981"
                  />
                )}
              </View>
              {!!err && <Text style={styles.errorText}>{err}</Text>}
              {!err && username.length > 0 && !validFormat && (
                <Text style={styles.hintText}>
                  ต้องเป็น a-z, 0-9 และ _ เท่านั้น (3–20 ตัว)
                </Text>
              )}

              <TouchableOpacity
                onPress={onSubmit}
                disabled={!canSubmit}
                style={[
                  styles.primaryBtn,
                  !canSubmit && { opacity: 0.6 },
                ]}
                activeOpacity={0.9}
              >
                <View style={styles.primaryBtnInner}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons
                        name="checkmark-done-outline"
                        size={18}
                        color="#fff"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.primaryBtnText}>บันทึกและเริ่มใช้งาน</Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>

              <View style={styles.smallNote}>
                <Ionicons name="information-circle-outline" size={14} color={TEXT_SUB} />
                <Text style={{ color: TEXT_SUB, marginLeft: 6, flex: 1 }}>
                  สามารถเปลี่ยนได้ภายหลังในตั้งค่าโปรไฟล์
                </Text>
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
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: TEXT_MAIN,
  },
  subtitle: {
    marginTop: 6,
    color: TEXT_SUB,
  },
  label: {
    color: TEXT_MAIN,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 8,
  },
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
  hintText: {
    color: TEXT_SUB,
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
  smallNote: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
  },
});
