// app/(tabs)/settings/profile-edit.tsx
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
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { getProfile, updateProfile, updateAvatar } from "../../lib/user";
import { showSnack } from "../../components/Snackbar"; // ✅ แก้ path

type FullUser = {
  id: number;
  email: string;
  username: string;
  avatar?: string | null;
  friend_code?: string | null; // คาดว่าบันทึกแบบไม่มีเว้นวรรค
  team?: string | null;
  level?: number | null;
  created_at?: string | null;
};

const teams = [
  {
    team: "Valor",
    image:
      "https://static.wikia.nocookie.net/pokemongo/images/2/22/Team_Valor.png/revision/latest?cb=20160717150715",
  },
  {
    team: "Mystic",
    image:
      "https://static.wikia.nocookie.net/pokemongo/images/f/f4/Team_Mystic.png/revision/latest?cb=20160717150716",
  },
  {
    team: "Instinct",
    image:
      "https://static.wikia.nocookie.net/pokemongo/images/d/d4/Team_Instinct.png/revision/latest?cb=20200803123751",
  },
];

export default function ProfileEdit() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [teamopen, setTeamopen] = useState(false); // modal เลือกทีม
  const [teamImage, setTeamImage] = useState(""); // รูปทีม

  // ฟอร์ม
  const [username, setUsername] = useState("");
  const [friendCode, setFriendCode] = useState("");
  const [team, setTeam] = useState(""); // เพิ่มทีม
  const [level, setLevel] = useState(""); // เก็บเป็น string เพื่อคุม input
  const [avatar, setAvatar] = useState<string | null>(null); // preview

  // รับเฉพาะตัวเลข สูงสุด 2 หลัก และคงอยู่ในช่วง 1–50
  const handleLevelChange = (t: string) => {
    const digits = t.replace(/\D/g, "").slice(0, 2);
    if (!digits) return setLevel("");
    const n = parseInt(digits, 10);
    if (isNaN(n) || n < 1) return setLevel("");
    if (n > 80) return setLevel("80");
    setLevel(String(n));
  };

  // ฟังชั่นช่อง รหัสเพิ่มเพื่อน เว้นวรรคทุก 4 ตัว
  function formatFriendCode(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 12);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim(); // XXXX XXXX XXXX
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const u = (await getProfile()) as FullUser;
      setUsername(u.username || "");
      // ถ้าเก็บ friend_code เป็นตัวเลขล้วน ให้ format ตอนแสดง
      setFriendCode(formatFriendCode(u.friend_code || ""));
      setLevel(u.level ? String(u.level) : "");
      setAvatar(u.avatar || null);
      setTeam(u.team || "");
      setTeamImage(
        teams.find((t) => t.team === u.team)?.image || ""
      );
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
    } catch {
      showSnack({ text: "อัปโหลดไม่สำเร็จ", variant: "error" });
    } finally {
      setUploading(false);
    }
  };

  const onSave = async () => {
    if (!username.trim()) {
      showSnack({ text: "กรุณากรอกชื่อผู้ใช้", variant: "error" });
      return;
    }

    // ตรวจ level (ถ้าใส่มา)
    let levelNum: number | undefined = undefined;
    if (level.trim() !== "") {
      const n = parseInt(level, 10);
      if (isNaN(n) || n < 1 || n > 80) {
        showSnack({ text: "เลเวลต้องเป็น 1–50", variant: "error" });
        return;
      }
      levelNum = n;
    }

    // ตัดช่องว่าง friend code ก่อนส่ง (อนุญาตว่างได้)
    const fcDigits = friendCode.replace(/\s/g, "");
    if (fcDigits && fcDigits.length !== 12) {
      showSnack({ text: "รหัสเพื่อนต้องมี 12 หลัก", variant: "error" });
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        username: username.trim(),
        friend_code: fcDigits || undefined,
        team: team || undefined,
        level: levelNum, // ✅ ส่ง level ไป API
      });
      showSnack({ text: "แก้ไขโปรไฟล์เรียบร้อย", variant: "success" });
      router.back();
    } catch {
      showSnack({ text: "บันทึกไม่สำเร็จ", variant: "error" });
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
            keyboardType="number-pad"
            maxLength={14} // 12 ตัว + เว้นวรรค 2 ช่อง
          />

          {/* เลือกทีม */}
          <Text style={styles.label}>ทีม</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setTeamopen(true)}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
            >
              {teamImage && (
                <Image
                  source={{ uri: teamImage }}
                  style={{ height: 20, width: 20 }}
                />
              )}
              <Text style={{ color: team ? "#111827" : "#9CA3AF", fontFamily: "KanitMedium" }}>
                {team || "เลือกทีม"}
              </Text>
            </View>
            <Ionicons
              name="chevron-down-outline"
              size={18}
              color="#9CA3AF"
              style={{ position: "absolute", right: 10, top: 10 }}
            />
          </TouchableOpacity>

          {/* modal เลือกทีม */}
          <Modal
            visible={teamopen}
            animationType="fade"
            transparent
            onRequestClose={() => setTeamopen(false)}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPressOut={() => setTeamopen(false)}
            >
              <View style={styles.modalContent}>
                <Text style={{ fontSize: 16, fontFamily: "KanitSemiBold" }}>
                  เลือกทีม
                </Text>
                {teams.map((t) => {
                return (
                  <TouchableOpacity
                    key={t.team}
                    style={[styles.modalItem, team === t.team && { backgroundColor: "#e5ebf7ff" }]}
                    onPress={() => {
                      setTeam(t.team);
                      setTeamImage(t.image);
                      setTeamopen(false);
                    }}
                  >
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <Image
                        source={{ uri: t.image }}
                        style={{ height: 40, width: 40 }}
                      />
                      <Text style={{ fontSize: 16, fontFamily: "KanitMedium" }}>{t.team}</Text>
                      {team === t.team && (
                        <Ionicons
                          name="checkmark"
                          size={30}
                          color="#2563EB"
                          style={{ marginLeft: "auto" }}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                )})}
              </View>
            </TouchableOpacity>
          </Modal>

          <Text style={styles.label}>เลเวล</Text>
          <TextInput
            value={level}
            onChangeText={handleLevelChange}
            placeholder="1-80"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            keyboardType="number-pad"
            maxLength={2} // ✅ แค่ 2 หลัก
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
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 16, fontFamily: "KanitSemiBold", color: "#111827" },

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
    fontFamily: "KanitSemiBold",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#111827",
    backgroundColor: "#fff",
    fontFamily: "KanitMedium"
  },

  outlineBtnText: { color: "#111827", fontFamily: "KanitSemiBold" },

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
  primaryBtnText: { color: "#fff", fontFamily: "KanitSemiBold", marginLeft: 6 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    width: 400,
  },
  modalItem: {
    paddingVertical: 12,
    marginTop: 8,
    borderRadius: 14,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingLeft: 12,
  },
});
