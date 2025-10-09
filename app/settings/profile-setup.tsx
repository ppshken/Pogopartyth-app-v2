// app/(tabs)/settings/profile-edit.tsx
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { getProfile, updateProfile } from "../../lib/user";
import { showSnack } from "../../components/Snackbar";

type FullUser = {
  id: number;
  email: string;
  username: string;
  avatar?: string | null;
  friend_code?: string | null; // เก็บใน DB แบบไม่มีเว้นวรรค
  level?: number | null;
  created_at?: string | null;
};

export default function ProfileEdit() {
  const router = useRouter();

  // Y/N
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  // ฟอร์ม
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [friendCode, setFriendCode] = useState(""); // แสดงแบบ XXXX XXXX XXXX
  const [level, setLevel] = useState(""); // เก็บ string เพื่อคุม input
  const [avatar, setAvatar] = useState<string | null>(null); // preview

  // ===== Helpers =====
  const onlyDigits = (s: string) => s.replace(/\D/g, "");

  const formatFriendCode = (v: string) => {
    const digits = onlyDigits(v).slice(0, 12);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim(); // XXXX XXXX XXXX
  };

  const handleLevelChange = (t: string) => {
    const digits = onlyDigits(t).slice(0, 2);
    if (!digits) return setLevel("");
    const n = parseInt(digits, 10);
    if (isNaN(n) || n < 1) return setLevel("");
    if (n > 80) return setLevel("80");
    setLevel(String(n));
  };

  // ===== Load profile =====
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = (await getProfile()) as FullUser;
      setEmail(u.email);
      setAvatar(u.avatar || null);
    } catch (e: any) {
      Alert.alert("โหลดโปรไฟล์ไม่สำเร็จ", e.message || "ลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ===== Validation (บังคับกรอกครบ) =====แ
  const passwordOk = useMemo(() => password.trim().length >= 8, [password]);
  const usernameOk = useMemo(() => username.trim().length >= 2, [username]);
  const friendCodeDigits = useMemo(
    () => friendCode.replace(/\s/g, ""),
    [friendCode]
  );
  const friendCodeOk = useMemo(
    () => friendCodeDigits.length === 12,
    [friendCodeDigits]
  );
  const levelOk = useMemo(() => {
    const n = Number(level);
    return Number.isInteger(n) && n >= 1 && n <= 80;
  }, [level]);

  const canSubmit =
    passwordOk && usernameOk && friendCodeOk && levelOk && !saving;

  // ===== Save =====
  const onSave = async () => {
    const levelNum = Number(level);
    const fcDigits = friendCodeDigits; // ไม่มีช่องว่าง

    setSaving(true);
    try {
      await updateProfile({
        password: password.trim(),
        username: username.trim(),
        friend_code: fcDigits,
        level: levelNum,
      });
      showSnack({ text: "ตั้งค่าโปรไฟล์เรียบร้อย", variant: "success" });
      router.replace("/(tabs)/room_raid");
    } catch (e: any) {
      showSnack({ text: e?.message || "บันทึกไม่สำเร็จ", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>กำลังโหลด...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#F9FAFB" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
        {/* การ์ดรูปโปรไฟล์ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>รูปโปรไฟล์</Text>
          <View style={{ alignItems: "center", marginTop: 8 }}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarEmpty}>
                <Ionicons
                  name="person-circle-outline"
                  size={56}
                  color="#9CA3AF"
                />
              </View>
            )}
            <Text>{email}</Text>
          </View>
        </View>

        {/* การ์ดข้อมูลผู้ใช้ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ข้อมูลผู้ใช้</Text>

          <Text style={styles.label}>รหัสผ่าน</Text>
          <View>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="อย่างน้อย 8 ตัวอักษร"
              returnKeyType="done"
              secureTextEntry={!showPw}
              placeholderTextColor="#9CA3AF"
              style={[
                styles.input,
                !passwordOk && password ? styles.inputError : null,
              ]}
            />
            <TouchableOpacity
              onPress={() => setShowPw((v) => !v)}
              hitSlop={12}
              style={{ position: "absolute", right: 10, top: 10 }}
            >
              <Ionicons
                name={showPw ? "eye-off-outline" : "eye-outline"}
                size={18}
                color="#7e8490ff"
              />
            </TouchableOpacity>
            {!passwordOk && password.length > 0 && (
              <Text style={styles.errorText}>อย่างน้อย 8 ตัวอักษร</Text>
            )}
          </View>

          <Text style={styles.label}>ชื่อตัวละคร</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="เช่น PikachuMaster"
            placeholderTextColor="#9CA3AF"
            style={[
              styles.input,
              !usernameOk && username ? styles.inputError : null,
            ]}
          />
          {!usernameOk && username.length > 0 && (
            <Text style={styles.errorText}>กรอกอย่างน้อย 2 อักษร</Text>
          )}

          <Text style={styles.label}>รหัสเพิ่มเพื่อน</Text>
          <TextInput
            value={friendCode}
            onChangeText={(t) => setFriendCode(formatFriendCode(t))}
            placeholder="เช่น 1234 5678 9012"
            placeholderTextColor="#9CA3AF"
            style={[
              styles.input,
              !friendCodeOk && friendCode ? styles.inputError : null,
            ]}
            keyboardType="number-pad"
            maxLength={14} // 12 ตัว + เว้นวรรค 2 ช่อง
          />
          {!friendCodeOk && friendCode.length > 0 && (
            <Text style={styles.errorText}>ต้องมี 12 ตัวเลข</Text>
          )}

          <Text style={styles.label}>เลเวล</Text>
          <TextInput
            value={level}
            onChangeText={handleLevelChange}
            placeholder="1-80"
            placeholderTextColor="#9CA3AF"
            style={[styles.input, !levelOk && level ? styles.inputError : null]}
            keyboardType="number-pad"
            maxLength={2}
          />
          {!levelOk && level.length > 0 && (
            <Text style={styles.errorText}>กรอก 1–80</Text>
          )}
        </View>

        {/* ปุ่มบันทึก */}
        <TouchableOpacity
          style={[
            styles.primaryBtnsave,
            { backgroundColor: canSubmit ? "#10B981" : "#A7F3D0" },
          ]}
          onPress={onSave}
          disabled={!canSubmit || saving}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color="#fff" />
              <Text style={styles.primaryBtnText}>บันทึก</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },

  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F3F4F6",
    marginBottom: 8,
  },
  avatarEmpty: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
  },

  label: {
    marginTop: 12,
    marginBottom: 6,
    color: "#374151",
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
    backgroundColor: "#fff",
  },
  inputError: {
    borderColor: "#DC2626",
  },
  errorText: { color: "#DC2626", marginTop: 6, fontSize: 12 },

  outlineBtnText: { color: "#111827", fontWeight: "800" },

  primaryBtn: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#111827",
  },
  primaryBtnsave: {
    marginTop: 8,
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", marginLeft: 6 },
});
