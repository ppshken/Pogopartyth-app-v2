// app/(tabs)/rooms/[id].tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import {
  getRoom,
  joinRoom,
  leaveRoom,
  getFriendReadyStatus,
  setFriendReady,
  updateStatus, // invited / closed
  reviewRoom, // rating 1-5 + comment (ใช้ comment ใส่เหตุผลตอนไม่สำเร็จ)
} from "../../lib/raid";
import { showSnack } from "../../components/Snackbar";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Member = {
  user_id: number;
  role: "owner" | "member";
  joined_at: string;
  username: string;
  avatar?: string | null;
  friend_code?: string | null;
  member_level: number;
  friend_ready?: 0 | 1;
};

type RoomOwner = {
  id: number;
  username: string;
  avatar?: string | null;
  friend_code?: string | null;
};

type RoomPayload = {
  room: {
    id: number;
    raid_boss_id: number;
    pokemon_image: string;
    boss: string;
    start_time: string;
    status: "active" | "closed" | "canceled" | "invited" | string;
    current_members: number;
    max_members: number;
    pokemon_tier: number;
    current_chat_messages: number; // ✅ จำนวนข้อความแชทล่าสุด (ถ้าแบ็กเอนด์ส่งมา)
    is_full?: boolean;
    note?: string | null;
    owner: RoomOwner;
  };
  members: Member[];
  you: {
    user_id: number;
    is_member: boolean;
    is_owner: boolean;
    role: "owner" | "member";
  };
  // ⬇️ ถ้าแบ็กเอนด์มีเมตารีวิว ให้ใช้ได้เลย (optional)
  meta?: {
    total_members?: number;
    review_done_count?: number;
    review_pending_count?: number;
  };
};

const Reasonfail = [
  { id: 1, reasonfail: "คนไม่ครบ" },
  { id: 2, reasonfail: "เวลาไม่พอ / เข้าไม่ทัน" },
  { id: 3, reasonfail: "ทีม/ตัวคาวน์เตอร์ไม่เหมาะ (CP ต่ำ ดาเมจน้อย)" },
  { id: 4, reasonfail: "สัญญาณเน็ต/แอปหลุด/เครื่องค้าง" },
  { id: 5, reasonfail: "อื่นๆ (โปรดระบุ)" },
];

const pad2 = (n: number) => n.toString().padStart(2, "0");
const toYmdHms = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(
    d.getHours()
  )}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;

function parseStart(s: string): Date {
  const iso = s.includes("T") ? s : s.replace(" ", "T");
  const d = new Date(iso);
  return isNaN(d.getTime()) ? new Date(s) : d;
}

/** >1ชม = ชม.นาทีวินาที, <1ชม = นาทีวินาที, <1นาที = วินาที */
function useCountdown(start: string) {
  const target = useMemo(() => parseStart(start).getTime(), [start]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const diffMs = target - now;
  const expired = diffMs <= 0;
  if (expired) return { expired: true, label: "หมดเวลา" };

  const totalSec = Math.floor(diffMs / 1000);
  const hh = Math.floor(totalSec / 3600);
  const mm = Math.floor((totalSec % 3600) / 60);
  const ss = totalSec % 60;

  let label = "";
  if (hh > 0) label = `เหลือ ${hh} ชม. ${pad2(mm)} นาที ${pad2(ss)} วินาที`;
  else if (mm > 0) label = `เหลือ ${mm} นาที ${pad2(ss)} วินาที`;
  else label = `เหลือ ${ss} วินาที`;

  return { expired: false, label };
}

export default function RoomDetail() {
  // ✅ hooks ทั้งหมดต้องอยู่ตรงนี้ (บนสุดเสมอ)
  const insets = useSafeAreaInsets();
  const [footerH, setFooterH] = useState(0);

  // ตีบอส - รีวิว ไม่สำเร็จ
  const [selectedReasonId, setSelectedReasonId] = useState<number | null>(null);
  const [customReason, setCustomReason] = useState("");

  const isOther = selectedReasonId === 5; // id=5 ใน Reasonfail คือ “อื่นๆ”
  const canSave =
    selectedReasonId !== null && (!isOther || customReason.trim().length > 0);

  // ⬇️ hooks ทั้งหมด “บนสุด” ของคอมโพเนนต์
  const { id } = useLocalSearchParams<{ id: string }>();
  const roomId = Number(id);
  const router = useRouter();

  const [data, setData] = useState<RoomPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // สถานะ “เพิ่มเพื่อนแล้ว”
  const [friendAdded, setFriendAdded] = useState<Record<number, boolean>>({});

  // โมดัลผลลัพธ์/รีวิว
  const [resultModal, setResultModal] = useState(false); // เลือก สำเร็จ/ไม่สำเร็จ
  const [ratingModal, setRatingModal] = useState(false); // ให้คะแนน 1-5
  const [failureModal, setFailureModal] = useState(false); // กรอกเหตุผลไม่สำเร็จ
  const [canceledRoom, setCanceledRoom] = useState(false); // ยกเลิกสร้างห้อง
  const [exitRoom, setExitRoom] = useState(false); // ออกจากห้อง
  const [rating, setRating] = useState<number>(5);

  // ป้องกันสั่งปิดห้องซ้ำ
  const closingRef = useRef(false);

  // โหลดข้อมูลห้อง
  const load = useCallback(async () => {
    const res = await getRoom(roomId);
    setData(res as RoomPayload);

    // โหลด ready-status ของเพื่อนเฉพาะตอนเราเป็นสมาชิก
    if (res?.you?.is_member) {
      try {
        const st = await getFriendReadyStatus(roomId);
        const map: Record<number, boolean> = {};
        (st.members as Member[]).forEach((m) => {
          if (m.role !== "owner") map[m.user_id] = !!m.friend_ready;
        });
        setFriendAdded(map);
      } catch {
        // เงียบไว้ได้
      }
    } else {
      setFriendAdded({});
    }
  }, [roomId]);

  // เริ่มโหลดครั้งแรก
  useEffect(() => {
    load();
  }, [load]);

  // โพลลิ่งทุก 3 วินาที (รีเฟรชหน้าจออัตโนมัติ)
  useEffect(() => {
    const t = setInterval(() => load(), 3000);
    return () => clearInterval(t);
  }, [load]);

  // เคาน์ดาวน์: ต้องเรียกทุกครั้ง (ใส่ fallback เมื่อ data ยังไม่มา)
  const startForCountdown =
    data?.room?.start_time ?? toYmdHms(new Date(Date.now() + 60_000));
  const { label: countdownLabel, expired } = useCountdown(startForCountdown);

  // ถ้ามีเมตารีวิวครบแล้ว (หลังเชิญ) → ปิดห้องอัตโนมัติ (ฝั่ง server ควรตรวจให้ชัวร์ด้วย)
  useEffect(() => {
    if (!data) return;
    if (data.room.status !== "invited") return;

    const total = data.meta?.total_members ?? data.members?.length ?? 0;
    const done =
      data.meta?.review_done_count ??
      (typeof data.meta?.review_pending_count === "number"
        ? total - (data.meta!.review_pending_count as number)
        : 0);

    if (total > 0 && done >= total && !closingRef.current) {
      closingRef.current = true;
      (async () => {
        try {
          await updateStatus(data.room.id, "closed");
          await load();
          showSnack({
            text: "รีวิวครบทุกคน ระบบปิดห้องให้เรียบร้อย",
            variant: "success",
          });
        } catch {
          // ถ้าเซิร์ฟเวอร์ยังไม่พร้อม/ไม่ยอมปิด ก็ไม่ลูปซ้ำ
        } finally {
          closingRef.current = false;
        }
      })();
    }
  }, [data, load]);

  // ก่อนมี data
  if (!data) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="small" color="#000000ff" />
      </View>
    );
  }

  // --- ตัวแปรช่วย ---
  const { room, you } = data;
  const isMember = you?.is_member;
  const isOwner = you?.is_owner;

  const members = data.members;
  const nonOwnerMembers = members.filter((m) => m.role !== "owner");
  const allAdded =
    nonOwnerMembers.length > 0 &&
    nonOwnerMembers.every((m) => friendAdded[m.user_id]);

  // สี/ข้อความสถานะ
  const statusBg =
    room.status === "invited"
      ? "#2563EB"
      : expired
      ? "#9CA3AF"
      : room.is_full || room.current_members >= room.max_members
      ? "#EF4444"
      : room.status === "active"
      ? "#10B981"
      : room.status === "canceled"
      ? "#d0444bff"
      : "#111827";

  const statusText =
    room.status === "invited"
      ? "เชิญแล้ว"
      : expired
      ? "หมดเวลา"
      : room.is_full || room.current_members >= room.max_members
      ? "เต็ม"
      : room.status === "active"
      ? "เปิดรับ"
      : room.status === "canceled"
      ? "ยกเลิก"
      : room.status === "closed"
      ? "ปิดห้อง"
      : room.status;

  // --- ฟังก์ชันจัดการต่าง ๆ ---
  const onJoinLeave = async () => {
    try {
      if (isMember) setLoading(false);
      else if (!isMember) setLoading(true);
      if (isMember && !isOwner) setExitRoom(true);
      else if (!isMember) await joinRoom(room.id);
      await load();
    } catch (e: any) {
      showSnack({ text: e.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  // ออกจากห้อง (สมาชิกธรรมดา)
  const onExitroom = async () => {
    try {
      setLoading(true);
      if (isMember && !isOwner) await leaveRoom(room.id);
      else if (!isMember) await joinRoom(room.id);
      setExitRoom(false);
      await load();
    } catch (e: any) {
      showSnack({ text: e.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  // คัดลอกชื่อผู้เล่น
  const copyUsernames = async () => {
    try {
      const names = members
        .filter((m) => m.role !== "owner")
        .map((m) => m.username || `User#${m.user_id}`);
      await Clipboard.setStringAsync(names.join(", "));
      showSnack({ text: "คัดลอกชื่อผู้เล่นเรียบร้อย", variant: "success" });
    } catch {
      showSnack({ text: "คัดลอกไม่สำเร็จ ลองใหม่อีกครั้ง", variant: "error" });
    }
  };

  // คัดลอกรหัสเพิ่มเพื่อนหัวห้อง
  const copyFriendCode = async () => {
    const code = room.owner?.friend_code?.trim();
    if (!code)
      return showSnack({
        text: "ไม่พบรหัส หัวห้องยังไม่ระบุ Friend Code",
        variant: "error",
      });
    await Clipboard.setStringAsync(code);
    showSnack({
      text: "คัดลอกรหัสเพิ่มเพื่อนของหัวห้องเรียบร้อย",
      variant: "success",
    });
  };

  // รีเฟรช
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  // สถานะเพิ่มเพื่อน
  const toggleFriend = async (uid: number) => {
    const prev = friendAdded[uid] || false;
    const next = !prev;
    setFriendAdded((m) => ({ ...m, [uid]: next })); // optimistic
    try {
      await setFriendReady(
        room.id,
        next,
        isOwner && uid !== you.user_id ? uid : undefined
      );
    } catch (e: any) {
      setFriendAdded((m) => ({ ...m, [uid]: prev })); // revert
      showSnack({ text: e.message, variant: "error" });
    }
  };

  // ยกเลิกห้อง → เปลี่ยนสถานะเป็น canceled
  const onCanceled = async () => {
    try {
      setLoading(true);
      await updateStatus(room.id, "canceled");
      showSnack({ text: "ยกเลิกห้องแล้วเรียบร้อย", variant: "success" });
      router.back();
    } catch (e: any) {
      showSnack({ text: e.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  // เชิญในเกม → เปลี่ยนสถานะเป็น invited
  const onInvite = async () => {
    try {
      setLoading(true);
      await updateStatus(room.id, "invited");
      showSnack({ text: "ได้ส่งเชิญไปยังสมาชิกเรียบร้อย", variant: "success" });
      await load();
    } catch (e: any) {
      showSnack({ text: e.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  // เปิด modal ยกเลิกห้อง
  const onCanceledRoom = () => setCanceledRoom(true);

  // เปิด modal “ตีบอสเสร็จ”
  const onBattleFinished = () => setResultModal(true);

  // ผล “สำเร็จ” ⇒ ให้ทุกคนรีวิว (รวม Owner ด้วย)
  const onResultSuccess = () => {
    setResultModal(false);
    setRating(5);
    setRatingModal(true);
  };

  // ส่งคะแนนรีวิว (ทุกคน)
  const onSubmitRating = async () => {
    try {
      setLoading(true);
      await reviewRoom(room.id, rating, "Raid success");
      setRatingModal(false);
      showSnack({ text: "บันทึกรีวิวเรียบร้อย", variant: "success" });
      await load();
      router.back();
    } catch (e: any) {
      showSnack({ text: e.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  // ผล “ไม่สำเร็จ”
  const onResultFail = () => {
    setResultModal(false);
    setSelectedReasonId(null);
    setCustomReason("");
    setFailureModal(true);
  };

  // ส่งเหตุผลไม่สำเร็จ (ให้คะแนน 1 พร้อมเหตุผล)
  const onSubmitFailReason = async () => {
    const selected = Reasonfail.find((r) => r.id === selectedReasonId);
    const reasonText = isOther
      ? customReason.trim()
      : selected?.reasonfail || "";

    if (!reasonText) {
      showSnack({
        text: "โปรดเลือกเหตุผลหรือระบุ 'อื่นๆ'",
        variant: "warning",
      });
    }

    try {
      setLoading(true);
      // จะ setFailReason(reasonText) ด้วยก็ได้ ถ้าต้องเก็บ state นี้ไว้ใช้อย่างอื่น
      await reviewRoom(room.id, 1, `FAILED: ${reasonText}`);
      setFailureModal(false);
      showSnack({ text: "บันทึกเหตุผลเรียบร้อย", variant: "success" });
      await load();
      router.back();
    } catch (e: any) {
      showSnack({ text: e.message, variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          // ✅ กันเนื้อหาโดนทับ ด้วยความสูง footer ที่วัดได้ + safe area
          paddingBottom: Math.max(insets.bottom, 12) + footerH + 12,
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.headerCard}>
          <Image source={{ uri: room.pokemon_image }} style={styles.cover} />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={styles.title}>{room.boss} #{room.id}</Text>
              <View style={[styles.badge, { backgroundColor: statusBg }]}>
                <Text style={styles.badgeText}>{statusText}</Text>
              </View>
            </View>

            <View style={styles.lineRow}>
              <Ionicons name="time-outline" size={16} color="#374151" />
              <Text style={styles.lineText}>{countdownLabel}</Text>
            </View>
            <View style={styles.lineRow}>
              <Ionicons name="people-outline" size={16} color="#374151" />
              <Text style={styles.lineText}>
                สมาชิก {room.current_members}/{room.max_members}
              </Text>
            </View>

            {room.status === "invited" ? (
              <View
                style={[
                  styles.noteBox,
                  {
                    backgroundColor: "#EFF6FF",
                    borderColor: "#93C5FD",
                    borderWidth: 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.noteText,
                    { color: "#1E3A8A", fontWeight: "700" },
                  ]}
                >
                  เชิญในเกมแล้ว — โปรดรีวิวหลังจบการตีบอส
                </Text>
              </View>
            ) : room.note ? (
              <View style={styles.noteBox}>
                <Text style={styles.noteText}>{room.note}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Friend code เจ้าของ */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>รหัสเพิ่มเพื่อนหัวห้อง</Text>
          <View style={styles.friendRow}>
            <Ionicons name="person-circle-outline" size={18} color="#374151" />
            <View style={{ flexDirection: "row" }}>
              <Text style={styles.friendText}>
                {room.owner?.username || "-"} • Friend Code:
              </Text>
              {isMember ? (
                <Text style={styles.friendText}>
                  {room.owner?.friend_code || "-"}
                </Text>
              ) : null}
            </View>
          </View>

          {/* สมาชิก (ไม่ใช่เจ้าของ) -> คัดลอกรหัสหัวห้อง */}
          {isMember && !isOwner ? (
            <TouchableOpacity
              onPress={copyFriendCode}
              style={styles.outlineBtn}
            >
              <Ionicons name="copy-outline" size={16} color="#111827" />
              <Text style={styles.outlineBtnText}>คัดลอกรหัสหัวห้อง</Text>
            </TouchableOpacity>
          ) : null}

          {/* เจ้าของ -> คัดลอกชื่อผู้เล่น */}
          {isOwner && allAdded ? (
            <TouchableOpacity onPress={copyUsernames} style={styles.outlineBtn}>
              <Ionicons name="copy-outline" size={16} color="#111827" />
              <Text style={styles.outlineBtnText}>คัดลอกชื่อผู้เล่น</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* ผู้เข้าร่วม */}
        <View style={styles.section}>
          <View style={styles.lineRow}>
            <Text style={styles.sectionTitle}>
              สมาชิก {room.current_members}/{room.max_members}
            </Text>
          </View>

          {members.length ? (
            members.map((m) => {
              const isOwnerRow = m.role === "owner";
              const iAmThisMember = m.user_id === data.you?.user_id;

              // โชว์ปุ่มเฉพาะ "ไม่ใช่หัวห้อง"
              const showBtn = !isOwnerRow;

              // สถานะห้อง/เวลา
              const isInvited = room.status === "invited";

              // สถานะ "เพิ่มเพื่อนแล้ว" (ใช้ค่าที่ sync กับ server ถ้าไม่มีใช้ local)
              const added = Boolean(
                friendAdded[m.user_id] ?? m.friend_ready === 1
              );

              // ✅ กดได้เฉพาะแถวของตัวเอง และไม่อยู่สถานะที่ไม่ให้กด
              const disabledBtn = !iAmThisMember || isInvited || expired;

              return (
                <TouchableOpacity
                  key={m.user_id}
                  style={[styles.memberItem, iAmThisMember && styles.meItem]}
                  onPress={() =>
                    router.push({
                      pathname: "/rooms/[id]/friend",
                      params: { id: Number(m.user_id) }, // ต้องแมพกับ [id]
                    })
                  }
                >
                  {m.avatar ? (
                    <Image source={{ uri: m.avatar }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarEmpty}>
                      <Text style={{ color: "#fff", fontWeight: "800" }}>
                        {m.username ? m.username.charAt(0).toUpperCase() : "?"}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 14,
                          fontWeight: "700",
                          color: "#111827",
                        }}
                        numberOfLines={1}
                      >
                        {m.username || `User#${m.user_id}`}
                      </Text>

                      {isOwnerRow && (
                        <Ionicons name="star" color={"#eb9525ff"} />
                      )}

                      <View
                        style={{
                          backgroundColor: "#3066dbff",
                          padding: 2,
                          paddingHorizontal: 4,
                          borderRadius: 4,
                        }}
                      >
                        <Text
                          style={{
                            color: "#ffffffff",
                            fontSize: 12,
                            fontWeight: "600",
                          }}
                        >
                          Level {m.member_level}
                        </Text>
                      </View>
                    </View>

                    <Text style={{ fontSize: 12, color: "#6B7280" }}>
                      {isOwnerRow ? "เจ้าของห้อง" : "สมาชิก"} •{" "}
                      {new Date(m.joined_at).toLocaleTimeString("th-TH", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Text>
                  </View>

                  {/* ✅ ปุ่ม "เพิ่มเพื่อนแล้ว" โชว์ทุกคนยกเว้นหัวห้อง และกดได้เฉพาะแถวของตัวเอง */}
                  {showBtn && (
                    <TouchableOpacity
                      disabled={disabledBtn}
                      onPress={() => iAmThisMember && toggleFriend(m.user_id)}
                      style={[
                        styles.smallBtn,
                        added ? styles.smallBtnDone : styles.smallBtnIdle,
                        disabledBtn && styles.smallBtnDisabled,
                      ]}
                    >
                      <Ionicons
                        name={added ? "checkmark-circle" : "person-add-outline"}
                        size={16}
                        color={
                          added ? "#fff" : disabledBtn ? "#9CA3AF" : "#111827"
                        }
                        style={{ marginRight: 6 }}
                      />
                      <Text
                        style={[
                          styles.smallBtnText,
                          added && { color: "#fff" },
                          !added && disabledBtn && { color: "#9CA3AF" },
                        ]}
                      >
                        เพิ่มเพื่อนแล้ว
                      </Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={{ color: "#9CA3AF" }}>ยังไม่มีสมาชิก</Text>
          )}
        </View>

        {/* How to วิธีการใช้งาน */}
        <View style={styles.sectionHowto}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            <Ionicons name="help-circle-outline" size={20} color="#111827" />
            <Text style={styles.sectionTitleHowto}>วิธีการใช้งาน</Text>
          </View>
          <Text style={styles.howtoDetail}>1. รอสมาชิกเข้าห้อง</Text>
          <Text style={styles.howtoDetail}>2. ให้สมาชิกเพิ่มเพื่อนหัวห้อง</Text>
          <Text style={styles.howtoDetail}>3. เพิ่มครบ → คัดลอกชื่อสมาชิก</Text>
          <Text style={styles.howtoDetail}>
            4. เชิญในเกมด้วยรายชื่อที่คัดลอก
          </Text>
          <Text style={styles.howtoDetail}>5. เชิญเสร็จ → กด “เชิญแล้ว”</Text>
          <Text style={styles.howtoDetail}>
            6. ตีเสร็จ → รีวิว สำเร็จ/ไม่สำเร็จ
          </Text>
        </View>
      </ScrollView>

      {/* แถบปุ่มคงที่ด้านล่าง */}
      <View
        onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
        style={[
          styles.footerBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        {isMember ? (
          <View>
            <TouchableOpacity
              disabled={
                loading ||
                expired ||
                room.status === "canceled" ||
                room.status === "closed"
              }
              onPress={() => router.push(`/rooms/${room.id}/chat`)}
              style={[
                styles.primaryBtn,
                {
                  backgroundColor: "#111827",
                  opacity:
                    expired ||
                    room.status === "canceled" ||
                    room.status === "closed"
                      ? 0.7
                      : 1,
                },
              ]}
            >
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={18}
                color="#fff"
              />
              <Text style={styles.primaryBtnText}>เข้าแชท</Text>
            </TouchableOpacity>
            {room.current_chat_messages > 0 && (
              <View
                style={{
                  position: "absolute",
                  right: 5,
                  top: 0,
                  backgroundColor: "#4178e8ff",
                  width: 20,
                  height: 20,
                  borderRadius: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text
                  style={{ color: "#ffffff", fontSize: 12, fontWeight: "700" }}
                >
                  {room.current_chat_messages}
                </Text>
              </View>
            )}
          </View>
        ) : null}

        {isOwner && allAdded && room.status !== "invited" ? (
          <TouchableOpacity
            onPress={onInvite}
            style={[styles.primaryBtn, { backgroundColor: "#2563EB" }]}
          >
            <Ionicons name="send-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>เชิญในเกม</Text>
          </TouchableOpacity>
        ) : null}

        {room.status === "invited" && isMember ? (
          <TouchableOpacity
            onPress={onBattleFinished}
            style={[styles.primaryBtn, { backgroundColor: "#10B981" }]}
          >
            <Ionicons name="flag-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>ตีบอสเสร็จ กด (รีวิว)</Text>
          </TouchableOpacity>
        ) : null}

        {room.current_members < 2 && isOwner && (
          <TouchableOpacity
            onPress={onCanceledRoom}
            style={[styles.primaryBtn, { backgroundColor: "#d0444bff" }]}
          >
            <Ionicons name="close-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>ยกเลิกห้อง</Text>
          </TouchableOpacity>
        )}

        {!isOwner && room.status !== "invited" ? (
          <TouchableOpacity
            onPress={onJoinLeave}
            disabled={loading || expired}
            style={[
              styles.primaryBtn,
              {
                backgroundColor: isMember ? "#EF4444" : "#10B981",
                opacity:
                  expired ||
                  room.status === "canceled" ||
                  room.status === "closed"
                    ? 0.7
                    : 1,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons
                  name={isMember ? "log-out-outline" : "log-in-outline"}
                  size={18}
                  color="#fff"
                />
                <Text style={styles.primaryBtnText}>
                  {isMember ? "ออกจากห้อง" : "เข้าร่วมห้อง"}
                </Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Modal: ยืนยันยกเลิกห้อง */}
      <Modal
        visible={canceledRoom}
        transparent
        animationType="fade"
        onRequestClose={() => setCanceledRoom(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>ต้องการยกเลิกห้อง?</Text>
            <TouchableOpacity
              onPress={onCanceled}
              style={[styles.modalBtn, { backgroundColor: "#d0444bff" }]}
            >
              <Ionicons name="close-circle-outline" size={18} color="#fff" />
              <Text style={styles.modalBtnText}>ยกเลิก</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setCanceledRoom(false)}
              style={[styles.modalBtn, styles.modalCancel]}
            >
              <Text style={[styles.modalBtnText, { color: "#111827" }]}>
                ยกเลิก
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: ออกจากห้อง */}
      <Modal
        visible={exitRoom}
        transparent
        animationType="fade"
        onRequestClose={() => setExitRoom(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>ต้องการออกจากห้อง?</Text>
            <TouchableOpacity
              onPress={onExitroom}
              style={[styles.modalBtn, { backgroundColor: "#EF4444" }]}
            >
              <Ionicons name="close-circle-outline" size={18} color="#fff" />
              <Text style={styles.modalBtnText}>ออกจากห้อง</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setExitRoom(false)}
              style={[styles.modalBtn, styles.modalCancel]}
            >
              <Text style={[styles.modalBtnText, { color: "#111827" }]}>
                ยกเลิก
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: เลือกผลลัพธ์ */}
      <Modal
        visible={resultModal}
        transparent
        animationType="fade"
        onRequestClose={() => setResultModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>ผลการตีบอส</Text>
            <TouchableOpacity
              onPress={onResultSuccess}
              style={[styles.modalBtn, { backgroundColor: "#10B981" }]}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={18}
                color="#fff"
              />
              <Text style={styles.modalBtnText}>สำเร็จ (ให้คะแนน)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onResultFail}
              style={[styles.modalBtn, { backgroundColor: "#EF4444" }]}
            >
              <Ionicons name="close-circle-outline" size={18} color="#fff" />
              <Text style={styles.modalBtnText}>ไม่สำเร็จ (ใส่เหตุผล)</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setResultModal(false)}
              style={[styles.modalBtn, styles.modalCancel]}
            >
              <Text style={[styles.modalBtnText, { color: "#111827" }]}>
                ยกเลิก
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: ให้คะแนน */}
      <Modal
        visible={ratingModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRatingModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>ให้คะแนนห้องบอส (1-5)</Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "center",
                marginVertical: 8,
              }}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity
                  key={n}
                  onPress={() => setRating(n)}
                  style={{ marginHorizontal: 6 }}
                >
                  <Ionicons
                    name={n <= rating ? "star" : "star-outline"}
                    size={28}
                    color="#F59E0B"
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              onPress={onSubmitRating}
              style={[styles.modalBtn, { backgroundColor: "#111827" }]}
            >
              <Text style={styles.modalBtnText}>บันทึก</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setRatingModal(false)}
              style={[styles.modalBtn, styles.modalCancel]}
            >
              <Text style={[styles.modalBtnText, { color: "#111827" }]}>
                ยกเลิก
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: เหตุผลไม่สำเร็จ */}
      <Modal
        visible={failureModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setFailureModal(false);
          setSelectedReasonId(null);
          setCustomReason("");
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>เหตุผลที่ไม่สำเร็จ</Text>

            {/* ตัวเลือกเหตุผลแบบรายการ */}
            <View style={{ gap: 8, marginBottom: 8 }}>
              {Reasonfail.map((r) => {
                const selected = r.id === selectedReasonId;
                return (
                  <TouchableOpacity
                    key={r.id}
                    onPress={() => setSelectedReasonId(r.id)}
                    style={[
                      styles.reasonOption,
                      selected && styles.reasonOptionSelected,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={18}
                      color={selected ? "#111827" : "#6B7280"}
                      style={{ marginRight: 8 }}
                    />
                    <Text
                      style={[
                        styles.reasonLabel,
                        selected && { color: "#111827", fontWeight: "700" },
                      ]}
                    >
                      {r.reasonfail}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* เลือก "อื่นๆ" แล้วค่อยแสดงช่องกรอก */}
            {isOther && (
              <TextInput
                value={customReason}
                onChangeText={setCustomReason}
                placeholder="โปรดระบุเหตุผล"
                placeholderTextColor="#9CA3AF"
                multiline
                style={[styles.textArea, { marginTop: 4 }]}
              />
            )}

            <TouchableOpacity
              onPress={onSubmitFailReason}
              disabled={!canSave}
              style={[
                styles.modalBtn,
                { backgroundColor: "#111827" },
                !canSave && styles.modalBtnDisabled,
              ]}
              accessibilityState={{ disabled: !canSave }}
            >
              <Text style={styles.modalBtnText}>บันทึก</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setFailureModal(false);
                setSelectedReasonId(null);
                setCustomReason("");
              }}
              style={[styles.modalBtn, styles.modalCancel]}
            >
              <Text style={[styles.modalBtnText, { color: "#111827" }]}>
                ยกเลิก
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 12,
  },
  cover: {
    width: 92,
    height: 92,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: "#F3F4F6",
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  badgeText: { color: "#fff", fontWeight: "800", fontSize: 12 },

  lineRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  lineText: { color: "#374151", fontSize: 14, marginLeft: 6 },

  noteBox: {
    backgroundColor: "#F3F4F6",
    padding: 8,
    borderRadius: 10,
    marginTop: 8,
  },
  noteText: { color: "#4B5563", fontSize: 12 },

  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  sectionTitleHowto: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  friendRow: { flexDirection: "row", alignItems: "center" },
  friendText: { color: "#374151", marginLeft: 6 },

  outlineBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#111827",
    backgroundColor: "#fff",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  outlineBtnText: { color: "#111827", fontWeight: "800" },

  memberItem: {
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginBottom: 8,
  },
  avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  avatarEmpty: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
    backgroundColor: "#222121ff",
    justifyContent: "center",
    alignItems: "center",
  },

  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  smallBtnIdle: { backgroundColor: "#fff", borderColor: "#111827" },
  smallBtnDone: { backgroundColor: "#10B981", borderColor: "#10B981" },
  smallBtnText: { fontSize: 12, fontWeight: "800", color: "#111827" },

  primaryBtn: {
    marginTop: 10,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "800", marginLeft: 8 },

  // Modal
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
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
  },
  modalBtn: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  modalBtnText: { color: "#fff", fontWeight: "800" },
  modalCancel: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },

  textArea: {
    minHeight: 90,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 12,
    color: "#111827",
    backgroundColor: "#F9FAFB",
  },
  smallBtnDisabled: {
    opacity: 0.7,
    borderColor: "#d4d4d4ff",
  },
  reasonOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 10,
    backgroundColor: "#F9FAFB",
  },
  reasonOptionSelected: {
    borderColor: "#111827",
    backgroundColor: "#F3F4F6",
  },
  reasonLabel: {
    fontSize: 14,
    color: "#374151",
  },
  modalBtnDisabled: {
    opacity: 0.5,
  },
  howtoDetail: {
    flex: 1,
    color: "#374151",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
  },
  sectionHowto: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginBottom: 14,
    paddingLeft: 14,
  },
  footerBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 8, // ระยะห่างระหว่างปุ่ม
    // เผื่ออยากให้มีเงาเล็ก ๆ
    // shadowColor: "#000",
    // shadowOpacity: 0.06,
    // shadowRadius: 6,
    // elevation: 6,   // Android
  },
  meItem: {
    backgroundColor: "#E6F0FF", // ฟ้าอ่อน
    borderColor: "#60A5FA",
    borderWidth: 1,
  },
});
