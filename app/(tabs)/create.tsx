import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { createRoom, RoomLog } from "../../lib/raid";
import { getActiveRaidBosses } from "../../lib/raidBoss"; // << ใช้ API ที่สร้างไว้
import { TierStars } from "../../components/TierStars";
import { showSnack } from "../../components/Snackbar";
import { useRefetchOnFocus } from "../../hooks/useRefetchOnFocus";

type RaidBoss = {
  raid_boss_id: number;
  pokemon_id: number;
  pokemon_name: string;
  pokemon_image: string;
  pokemon_tier: number;
  start_date: string;
  end_date: string;
  created_at: string;
};

const FALLBACK =
  "https://static.wikia.nocookie.net/pokemongo/images/5/55/Emblem_Raid.png/revision/latest?cb=20170907130239";

const MIN_HOUR = 5; // 05:00
const MAX_HOUR = 23; // 23:00
const STEP_MIN = 5; // step 5 นาที

const pad = (n: number) => n.toString().padStart(2, "0");
const formatYmdHms = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

function ceilToStep(date: Date, stepMin: number) {
  const d = new Date(date);
  d.setSeconds(0, 0);
  const m = d.getMinutes();
  const add = (stepMin - (m % stepMin)) % stepMin;
  d.setMinutes(m + add);
  return d;
}

function generateTimeSlots(now = new Date()): { label: string; date: Date }[] {
  const slots: { label: string; date: Date }[] = [];
  const fiveLater = new Date(now.getTime() + 5 * 60 * 1000);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const earliestToday = new Date(today);
  earliestToday.setHours(MIN_HOUR, 0, 0, 0);

  let start = ceilToStep(fiveLater, STEP_MIN);
  if (start.getHours() < MIN_HOUR) {
    start = new Date(today);
    start.setHours(MIN_HOUR, 0, 0, 0);
  }

  const todayEnd = new Date(today);
  todayEnd.setHours(MAX_HOUR, 0, 0, 0);

  const useTomorrow = start.getTime() > todayEnd.getTime();
  const baseDay = new Date(today);
  if (useTomorrow) baseDay.setDate(baseDay.getDate() + 1);

  const begin = new Date(baseDay);
  if (useTomorrow) begin.setHours(MIN_HOUR, 0, 0, 0);
  else begin.setTime(start.getTime());

  const end = new Date(baseDay);
  end.setHours(MAX_HOUR, 0, 0, 0);

  const cursor = new Date(begin);
  while (cursor.getTime() <= end.getTime()) {
    const hh = pad(cursor.getHours());
    const mm = pad(cursor.getMinutes());
    slots.push({ label: `${hh}:${mm}`, date: new Date(cursor) });
    cursor.setMinutes(cursor.getMinutes() + STEP_MIN);
  }
  return slots;
}

export default function CreateRoom() {
  const router = useRouter();
  const [howto, setHowto] = useState(true);

  // 1) Boss (จาก API)
  const [bossOpen, setBossOpen] = useState(false);
  const [boss, setBoss] = useState<RaidBoss | null>(null);
  const [bosses, setBosses] = useState<RaidBoss[]>([]);
  const [loadingBoss, setLoadingBoss] = useState(false);
  const [q, setQ] = useState("");

  const loadBosses = useCallback(async () => {
    setLoadingBoss(true);
    try {
      const items = await getActiveRaidBosses(q ? { q, all: 1 } : { all: 1 });
      setBosses(items);
      if (!boss && items.length) setBoss(items[0]); // auto เลือกตัวแรกหากยังไม่มี
    } catch (e: any) {
      showSnack({
        text: `ผิดพลาด${
          e?.message ? ` : ${e.message}` : "โหลดรายชื่อบอสไม่สำเร็จ"
        }`,
        variant: "error",
      });
    } finally {
      setLoadingBoss(false);
    }
  }, [q, boss]);

  useRefetchOnFocus(loadBosses, [loadBosses]);

  useEffect(() => {
    loadBosses();
  }, [loadBosses]);

  // 2) Time
  const [timeOpen, setTimeOpen] = useState(false);
  const [slots, setSlots] = useState<{ label: string; date: Date }[]>([]);
  const [startAt, setStartAt] = useState<Date>(() => {
    const s =
      generateTimeSlots()[0]?.date ?? new Date(Date.now() + 30 * 60 * 1000);
    s.setSeconds(0, 0);
    return s;
  });

  useEffect(() => {
    setSlots(generateTimeSlots());
  }, []);

  // 3) Max members
  const [peopleOpen, setPeopleOpen] = useState(false);
  const PEOPLE = useMemo(() => Array.from({ length: 9 }, (_, i) => i + 2), []);
  const [max, setMax] = useState<number>(6);

  // 4) Note
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(false);
  const isPast = startAt.getTime() <= Date.now();
  const canSubmit = !loading && !!boss && !isPast && max >= 2 && max <= 20;

  const refreshTimeSlots = async () => {
    setSlots(generateTimeSlots());
    setStartAt(() => {
      const s =
        generateTimeSlots()[0]?.date ?? new Date(Date.now() + 30 * 60 * 1000);
      s.setSeconds(0, 0);
      return s;
    });
  };

  const onSubmit = async () => {
    if (!canSubmit) {
      showSnack({
        text: `ข้อมูลไม่ครบ${
          isPast ? "เวลาต้องอยู่ในอนาคต" : "กรุณาเลือกข้อมูลให้ครบ"
        }`,
        variant: "error",
      });
      return;
    }
    try {
      setLoading(true);
      const payload = {
        raid_boss_id: boss.raid_boss_id,
        pokemon_image: boss.pokemon_image,
        boss: boss!.pokemon_name, // << ส่งชื่อบอสจาก API
        start_time: formatYmdHms(startAt),
        max_members: max,
        note: note.trim() || undefined,
      };
      const room = await createRoom(payload);
      const payloadLog = {
        room_id: room.id,
        type: "create",
        description: "สร้างห้อง",
      };
      await RoomLog(payloadLog);
      showSnack({ text: "สร้างห้องสำเร็จ", variant: "success" });
      router.push(`/rooms/${room.id}`);
    } catch (e: any) {
      showSnack({
        text: `สร้างห้องไม่สำเร็จ${e?.message ? ` : ${e.message}` : ""}`,
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
        keyboardVerticalOffset={80}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
          {/* Boss dropdown */}
          <View style={styles.card}>
            <Text style={styles.label}>บอส</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setBossOpen(true)}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  flex: 1,
                }}
              >
                <Image
                  source={{ uri: boss?.pokemon_image || FALLBACK }}
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 8,
                    backgroundColor: "#F3F4F6",
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{ color: "#111827", fontFamily: "KanitSemiBold" }}
                  >
                    {boss?.pokemon_name || "เลือกบอสจากรายการ"}
                  </Text>
                  {!!boss && (
                    <Text style={{ color: "#6B7280", fontSize: 12 }}>
                      <TierStars
                        pokemon_tier={boss.pokemon_tier}
                        color="#ffcc00"
                      />
                    </Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-down-sharp" size={20} color="#111827" />
            </TouchableOpacity>
          </View>

          {/* Time dropdown */}
          <View style={styles.card}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Text style={styles.label}>เวลาที่รอห้อง</Text>
              <TouchableOpacity onPress={refreshTimeSlots}>
                <Text style={styles.link}>รีเฟรชเวลา</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setTimeOpen(true)}
            >
              <Text style={{ fontFamily: "KanitMedium", color: "#111827" }}>
                {startAt.toLocaleTimeString("th-TH", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </Text>
              <Ionicons name="chevron-down-sharp" size={20} color="#111827" />
            </TouchableOpacity>
            {isPast && (
              <Text
                style={{
                  color: "#EF4444",
                  marginTop: 8,
                  fontSize: 12,
                  fontFamily: "KanitMedium",
                }}
              >
                เวลาต้องอยู่ในอนาคต
              </Text>
            )}
            <Text
              style={{
                color: "#6B7280",
                marginTop: 6,
                fontSize: 12,
                fontFamily: "KanitRegular",
              }}
            >
              เวลาระหว่างวัน 5:00 - 23:00 โดยแบ่งออก รอบละ 5 นาที
            </Text>
          </View>

          {/* People dropdown */}
          <View style={styles.card}>
            <Text style={styles.label}>จำนวนสมาชิก</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setPeopleOpen(true)}
            >
              <Text style={{ fontFamily: "KanitMedium", color: "#111827" }}>
                {max} คน
              </Text>
              <Ionicons name="chevron-down-sharp" size={20} color="#111827" />
            </TouchableOpacity>
            <Text
              style={{
                color: "#6B7280",
                marginTop: 6,
                fontSize: 12,
                fontFamily: "KanitRegular",
              }}
            >
              เลือกสมาชิกได้สูงสุด 2–20 คน
            </Text>
          </View>

          {/* Note */}
          <View style={styles.card}>
            <Text style={styles.label}>หมายเหตุ</Text>
            <TextInput
              placeholder="พิมพ์หมายเหตุ เช่น ขอคนมี Remote Pass"
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={100}
              style={[styles.textarea, { fontFamily: "KanitRegular" }]}
              placeholderTextColor="#9CA3AF"
            />
            <Text
              style={{
                color: "#6B7280",
                marginTop: 6,
                fontSize: 12,
                fontFamily: "KanitRegular",
              }}
            >
              สามารถใส่ได้ไม่เกิน 100 ตัวอักษร
            </Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            onPress={onSubmit}
            disabled={!canSubmit}
            style={[
              styles.submit,
              !canSubmit && { backgroundColor: "#D1D5DB" },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text
                style={{
                  color: "#fff",
                  fontFamily: "KanitSemiBold",
                  textAlign: "center",
                }}
              >
                สร้างห้อง
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Boss modal */}
      <Modal
        visible={bossOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setBossOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  fontFamily: "KanitSemiBold",
                  fontSize: 16,
                  marginBottom: 8,
                  textAlign: "center",
                }}
              >
                เลือกบอส
              </Text>
              <TouchableOpacity
                onPress={() => setBossOpen(false)}
                style={styles.iconBtn}
              >
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>

            {/* search bar */}
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color="#6B7280" />
              <TextInput
                placeholder="ค้นหาชื่อบอส"
                placeholderTextColor="#9CA3AF"
                value={q}
                onChangeText={setQ}
                onSubmitEditing={loadBosses}
                style={[styles.searchInput, { fontFamily: "KanitRegular" }]}
              />
              <TouchableOpacity onPress={loadBosses}>
                <Text style={styles.link}>ค้นหา</Text>
              </TouchableOpacity>
            </View>

            {loadingBoss ? (
              <View style={{ padding: 16, alignItems: "center" }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 8, color: "#6B7280" }}>
                  กำลังโหลด...
                </Text>
              </View>
            ) : (
              <FlatList
                data={bosses}
                keyExtractor={(x) => String(x.pokemon_id) + x.pokemon_name}
                renderItem={({ item }) => {
                  const selected = boss?.raid_boss_id === item.raid_boss_id;
                  return (
                    <TouchableOpacity
                      onPress={() => {
                        setBoss(item);
                        setBossOpen(false);
                      }}
                      style={[
                        styles.itemRow,
                        selected && { backgroundColor: "#e5ebf7ff" },
                      ]}
                    >
                      <Image
                        source={{ uri: item.pokemon_image || FALLBACK }}
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 10,
                          marginRight: 12,
                          backgroundColor: "#F3F4F6",
                        }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: "KanitSemiBold",
                            color: "#111827",
                          }}
                        >
                          {item.pokemon_name}
                        </Text>
                        <Text style={{ color: "#6B7280", fontSize: 12 }}>
                          <TierStars
                            pokemon_tier={item.pokemon_tier}
                            color="#ffcc00"
                          />
                        </Text>
                      </View>
                      {selected ? (
                        <Ionicons name="checkmark" size={20} color="#2563EB" />
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                ListEmptyComponent={
                  <Text
                    style={{
                      color: "#9CA3AF",
                      textAlign: "center",
                      marginTop: 8,
                      fontFamily: "KanitRegular",
                    }}
                  >
                    ไม่พบบอสในช่วงเวลานี้
                  </Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Time modal */}
      <Modal
        visible={timeOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setTimeOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text style={{ fontFamily: "KanitSemiBold", fontSize: 16 }}>
                เลือกเวลา
              </Text>
              <TouchableOpacity
                onPress={() => setTimeOpen(false)}
                style={styles.iconBtn}
              >
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={slots}
              keyExtractor={(x) => x.label}
              initialNumToRender={40}
              getItemLayout={(_, index) => ({
                length: 48,
                offset: 48 * index,
                index,
              })}
              renderItem={({ item }) => {
                const selected =
                  Math.abs(item.date.getTime() - startAt.getTime()) < 60000;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setStartAt(item.date);
                      setTimeOpen(false);
                    }}
                    style={[
                      styles.listItem,
                      selected && { backgroundColor: "#e5ebf7ff" },
                    ]}
                  >
                    <Text
                      style={{ fontFamily: "KanitSemiBold", color: "#111827" }}
                    >
                      {item.label}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={20} color="#2563EB" />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
            />
          </View>
        </View>
      </Modal>

      {/* People modal */}
      <Modal
        visible={peopleOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setPeopleOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text style={{ fontFamily: "KanitSemiBold", fontSize: 16 }}>
                จำนวนสมาชิก
              </Text>
              <TouchableOpacity
                onPress={() => setPeopleOpen(false)}
                style={styles.iconBtn}
              >
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={PEOPLE}
              keyExtractor={(x) => String(x)}
              renderItem={({ item }) => {
                const selected = item === max;
                return (
                  <TouchableOpacity
                    onPress={() => {
                      setMax(item);
                      setPeopleOpen(false);
                    }}
                    style={[
                      styles.listItem,
                      selected && { backgroundColor: "#e5ebf7ff" },
                    ]}
                  >
                    <Text
                      style={{ fontFamily: "KanitSemiBold", color: "#111827" }}
                    >
                      {item} คน
                    </Text>
                    {item === max ? (
                      <Ionicons name="checkmark" size={20} color="#2563EB" />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
            />
          </View>
        </View>
      </Modal>

      {/* วิธีการใช้งาน */}
      <Modal
        visible={howto}
        transparent
        animationType="fade"
        onRequestClose={() => setHowto(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>วิธีการสร้างห้อง</Text>

            <View style={styles.bulletRow}>
              <Ionicons name="shield-outline" size={18} color="#111827" />
              <Text style={styles.bulletText}>
                เลือกบอสจากรายการ (มีรูป + ดาวตามเทียร์)
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <Ionicons name="time-outline" size={18} color="#111827" />
              <Text style={styles.bulletText}>
                เลือกเวลาเริ่ม (ดรอปดาวน์): วันนี้จากเวลาปัจจุบัน +5 นาที ทุกๆ 5
                นาทีจนถึง 23:00 ถ้าเลยช่วงแล้วจะแสดงของพรุ่งนี้ 05:00–23:00
              </Text>
            </View>

            <View style={styles.bulletRow}>
              <Ionicons name="people-outline" size={18} color="#111827" />
              <Text style={styles.bulletText}>เลือกจำนวนสมาชิก 2–20 คน</Text>
            </View>

            <View style={styles.bulletRow}>
              <Ionicons name="create-outline" size={18} color="#111827" />
              <Text style={styles.bulletText}>
                กรอกหมายเหตุ (ถ้ามี) แล้วกด “สร้างห้อง”
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setHowto(false)}
              style={styles.modalPrimaryBtn}
            >
              <Text style={styles.modalPrimaryBtnText}>ปิด</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  label: {
    fontSize: 14,
    color: "#111827",
    marginBottom: 8,
    fontFamily: "KanitSemiBold",
  },
  dropdown: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  textarea: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    minHeight: 90,
    textAlignVertical: "top",
    color: "#111827",
  },
  submit: {
    backgroundColor: "#111827",
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
  },

  link: { color: "#2563EB", fontFamily: "KanitMedium" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: "80%",
    paddingBottom: 30,
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: { flex: 1, color: "#111827" },

  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },

  btnOutline: {
    borderWidth: 1,
    borderColor: "#111827",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  btnOutlineText: { fontWeight: "800", color: "#111827" },

  listItem: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
  },
  helpBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  helpBtnText: { color: "#111827", fontWeight: "700" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "KanitSemiBold",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 8,
  },
  bulletText: {
    flex: 1,
    color: "#374151",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "KanitRegular",
  },

  modalPrimaryBtn: {
    marginTop: 12,
    backgroundColor: "#111827",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalPrimaryBtnText: { color: "#fff", fontFamily: "KanitMedium" },
  iconBtn: {
    marginLeft: "auto",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
});
