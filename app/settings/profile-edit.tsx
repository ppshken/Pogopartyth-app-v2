// app/settings/profile-edit.tsx
import React, { useEffect, useState, useCallback } from "react";
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
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { getProfile, updateProfile, updateAvatar } from "../../lib/user";
import { showSnack } from "../..//components/Snackbar";

type FullUser = {
  id: number;
  email: string;
  username: string;
  avatar?: string | null;
  friend_code?: string | null;
  trainer_name?: string | null;
  created_at?: string | null;
};

export default function ProfileEdit() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ฟอร์ม
  const [username, setUsername] = useState("");
  const [friendCode, setFriendCode] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null); // preview

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = (await getProfile()) as FullUser;
      setUsername(u.username || "");
      setFriendCode(u.friend_code || "");
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

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("ไม่ได้รับอนุญาต", "กรุณาอนุญาตเข้าถึงคลังรูปภาพ");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!res.canceled && res.assets?.length) {
      setAvatar(res.assets[0].uri);
    }
  };

  const onUploadAvatar = async () => {
    if (!avatar) {
      Alert.alert("เลือกรูปก่อน", "กรุณาเลือกรูปโปรไฟล์");
      return;
    }
    setUploading(true);
    try {
      await updateAvatar({ uri: avatar });
      showSnack({ text: "อัปเดตรูปโปรไฟล์แล้ว", variant: "success" });
      router.back();
    } catch (e: any) {
      showSnack({ text: "อัปโหลดไม่สำเร็จ", variant: "error" });
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    // ตรวจง่าย ๆ
    if (!username.trim()) {
      Alert.alert("กรอกไม่ครบ", "กรุณากรอก Username");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        username: username.trim(),
        friend_code: friendCode.trim() || undefined,
      });
      showSnack({ text: "แก้ไขโปรไฟล์เรียบร้อย", variant: "success" });
      router.back();
    } catch (e: any) {
      showSnack({ text: "บันทึกไม่สำเร็จ", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  // ฟังชั่นช่อง รหัสเพิ่มเพื่อน เว้นวรรค 4
  function formatFriendCode(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 12);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim(); // XXXX XXXX XXXX
  }

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

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={styles.primaryBtn} onPress={pickImage}>
                <Ionicons name="images-outline" size={16} color="#111827" />
                <Text style={styles.outlineBtnText}>เลือกรูป</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: "#111827" }]}
                onPress={onUploadAvatar}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={16}
                      color="#fff"
                    />
                    <Text style={styles.primaryBtnText}>อัปโหลด</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* การ์ดข้อมูลผู้ใช้ */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>ข้อมูลผู้ใช้</Text>

          <Text style={styles.label}>ชื่อตัวละคร</Text>
          <TextInput
            value={username}
            onChangeText={setUsername}
            placeholder="เช่น PikachuMaster"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
          />

          <Text style={styles.label}>รหัสเพิ่มเพื่อน</Text>
          <TextInput
            value={friendCode}
            onChangeText={(t) => setFriendCode(formatFriendCode(t))}
            placeholder="เช่น 1234 5678 9012"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            autoCapitalize="characters"
            keyboardType="number-pad"
            maxLength={14}
          />
        </View>

        {/* ปุ่มบันทึก */}
        <TouchableOpacity
          style={[styles.primaryBtnsave, { backgroundColor: "#10B981" }]}
          onPress={onSave}
          disabled={saving}
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
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#111827" },

  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#F3F4F6",
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

  outlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#111827",
    backgroundColor: "#fff",
  },
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
