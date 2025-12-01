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
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
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
  updateStatus,
  reviewRoom,
  kickMember,
  CancelRoom,
  RoomLog,
  getRoomLog,
} from "../../lib/raid";
import { openPokemonGo } from "../../lib/openpokemongo";
import { showSnack } from "../../components/Snackbar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatFriendCode } from "../../function/formatFriendCode";
import ShareRoom from "../../components/ShareRoom";
import { minutesAgoTH } from "../../hooks/useTimeAgoTH";
import { Friend, getFriendAvailable } from "../../lib/friend";
import { AvatarComponent } from "../../components/Avatar";
import { logTypeColor, iconType } from "@/hooks/logTypeColor";
import { countdown } from "@/function/countdown";
import { profile } from "../../lib/auth";
import { BossImage } from "../../components/BossImage";

type Member = {
  user_id: number;
  role: "owner" | "member";
  joined_at: string;
  username: string;
  avatar?: string;
  friend_code?: string | null;
  team?: string | null;
  plan?: string;
  member_level: number;
  friend_ready?: 0 | 1;
  is_review?: 0 | 1;
};

type RoomOwner = {
  id: number;
  username: string;
  avatar?: string | null;
  friend_code?: string | null;
  device_token?: string;
};

type Raidboss = {
  combat_power: {
    normal: { min: number; max: number };
    boosted: { min: number; max: number };
  };
};

type RoomPayload = {
  room: {
    id: number;
    raid_boss_id: number;
    pokemon_image: string;
    boss: string;
    special: boolean | null;
    boss_type: string;
    start_time: string;
    status: "active" | "closed" | "canceled" | "invited" | string;
    current_members: number;
    max_members: number;
    pokemon_tier: number;
    current_chat_messages: number;
    is_full?: boolean;
    note?: string | null;
    min_level: number;
    vip_only: boolean | null;
    lock_room: boolean | null;
    password_room: string | null;
    owner: RoomOwner;
    raid_boss?: Raidboss;
  };
  members: Member[];
  you: {
    user_id: number;
    is_member: boolean;
    is_owner: boolean;
    is_review: boolean;
    role: "owner" | "member";
  };
  // ⬇️ ถ้าแบ็กเอนด์มีเมตารีวิว ให้ใช้ได้เลย (optional)
  meta?: {
    total_members?: number;
    review_done_count?: number;
    review_pending_count?: number;
  };
};

type RoomLogList = {
  id: number;
  room_id: number;
  user_id: number;
  type: string;
  target: string;
  description: string;
  created_at: string;
  username: string;
  avatar?: string | null;
};

const FALLBACK = "";

const PokemonGoIcon =
  "https://play-lh.googleusercontent.com/cKbYQSRgvec6n2oMJLVRWqHS8BsH9AxBp-cFGrGqve3CpE4EmI3Ofej1RCUciQbqhebCfiDIomUQINqzIL4I7kk"; // ใส่ไอคอน Pokemon Go ที่เหมาะสม

const Reasonfail = [
  { id: 1, reasonfail: "คนไม่ครบ" },
  { id: 2, reasonfail: "เวลาไม่พอ / เข้าไม่ทัน" },
  { id: 3, reasonfail: "ทีม/ตัวคาวน์เตอร์ไม่เหมาะ (CP ต่ำ ดาเมจน้อย)" },
  { id: 4, reasonfail: "สัญญาณเน็ต/แอปหลุด/เครื่องค้าง" },
  { id: 5, reasonfail: "อื่นๆ (โปรดระบุ)" },
];

const ReasonCancel = [
  { id: 1, reasoncancel: "เปลี่ยนใจไม่ตีบอส" },
  { id: 2, reasoncancel: "บอสหมดเวลา" },
  { id: 3, reasoncancel: "สร้างห้องผิดพลาด" },
  { id: 4, reasoncancel: "อื่นๆ (โปรดระบุ)" },
];

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
  const [log, setLog] = useState<RoomLogList[]>([]);
  const [loglimit, setLoglimit] = useState(5);
  const [logtotal, setLogtotal] = useState(0);
  const [loadingdata, setLoadingdata] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingAdd, setLoadingAdd] = useState(false);
  const [loadingKick, setLoadingKick] = useState(false);
  const [loadingExit, setLoadingExit] = useState(false);
  const [loadingClose, setLoadingClose] = useState(false);
  const [loadingSaveReview, setLoadingSaveReview] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [forseReview, setForseReview] = useState(true);

  const [copied, setCopied] = useState(false); // คัดลอกชื่อผู้เล่น

  // เปิด Modal เชิญเพื่อน
  const [onInvitedFriend, setOnInvitedFriend] = useState(false);
  const [loadfriend, setLoadfriend] = useState(false);
  const [friendsData, setFriendsData] = useState<Friend[]>([]);
  const [q, setQ] = useState(""); // Add search query state
  const [invitedMap, setInvitedMap] = useState<Record<number, boolean>>({});
  const [loadingMap, setLoadingMap] = useState<Record<number, boolean>>({});

  //เปิด modal เข้าร่วมห้อง
  const [joinModal, setJoinModal] = useState(false); // โมดัลเข้าร่วมห้อง

  const [onPassword, setOnPassword] = useState(false);
  const [passwordRoom, setPasswordRoom] = useState("");

  // สถานะ “เพิ่มเพื่อนแล้ว”
  const [friendAdded, setFriendAdded] = useState<Record<number, boolean>>({});

  // โมดัลผลลัพธ์/รีวิว
  const [resultModal, setResultModal] = useState(false); // เลือก สำเร็จ/ไม่สำเร็จ
  const [ratingModal, setRatingModal] = useState(false); // ให้คะแนน 1-5
  const [failureModal, setFailureModal] = useState(false); // กรอกเหตุผลไม่สำเร็จ

  // Modal ยกเลิกห้อง
  const [cancelRoomModal, setCancelRoomModal] = useState(false);
  const [cancelReasonId, setCancelReasonId] = useState<number | null>(null);
  const [cancelCustomReason, setCancelCustomReason] = useState("");
  const cancelOther = cancelReasonId === 4; // id=4 ใน ReasonCancel คือ “อื่นๆ”
  const canCancel =
    cancelReasonId !== null &&
    (cancelReasonId !== 4 || cancelCustomReason.trim().length > 0); // id=4 ใน ReasonCancel คือ “อื่นๆ”

  // สถานะยืนยันต่างๆ
  const [canceledRoom, setCanceledRoom] = useState(false); // ยกเลิกสร้างห้อง
  const [exitRoom, setExitRoom] = useState(false); // ออกจากห้อง
  const [kickmember, setKickmember] = useState<number | false>(false); // เตะ
  const [rating, setRating] = useState<number>(5);

  // คลูดาวน์ ก่อนเข้าห้อง
  const [onCooldown, setOnCooldown] = useState(false);
  const [left, setLeft] = useState(10);
  const [running, setRunning] = useState(false);
  const [onJoin, setOnjoin] = useState(false);

  // User VIP
  const [vip, setVip] = useState(false);
  const [userlevel, setUserlevel] = useState(0);

  // ป้องกันสั่งปิดห้องซ้ำ
  const closingRef = useRef(false);

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

  const cooldown = useCallback(async () => {
    if (running) return;
    setRunning(true);
    const ok = await countdown(10, setLeft); // นับ 10→0
    if (ok) {
      return setOnjoin(true);
    }
    setRunning(false);
  }, [running]);

  /** >1ชม = ชม.นาทีวินาที, <1ชม = นาทีวินาที, <1นาที = วินาที */
  function useCountdown(start: string) {
    const target = useMemo(() => parseStart(start).getTime(), [start]);
    const [now, setNow] = useState(() => Date.now());
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const firedRef = useRef(false); // กัน onExpire ยิงซ้ำ

    useEffect(() => {
      const t = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(t);
    }, []);

    const diffMs = target - now;
    const expired = diffMs <= 0;
    // หมดเวลาปุ๊บ: หยุด interval + call onExpire (ครั้งเดียว)
    useEffect(() => {
      if (expired) {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        if (!firedRef.current && data?.room.status === "active") {
          firedRef.current = true;
          console.log("log", true);
        }
      }
    }, [expired]);

    if (expired)
      return {
        expired: true,
        label: "หมดเวลา",
      };

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

  // เคาน์ดาวน์: ต้องเรียกทุกครั้ง (ใส่ fallback เมื่อ data ยังไม่มา)
  const startForCountdown =
    data?.room?.start_time ?? toYmdHms(new Date(Date.now() + 60_000));
  const { label: countdownLabel, expired } = useCountdown(startForCountdown);

  // โหลดข้อมูลห้อง
  const load = useCallback(async () => {
    setLoadingdata(true);
    try {
      const res = await getRoom(roomId);
      const logdata = await getRoomLog(roomId, loglimit as number);
      setData(res as RoomPayload);
      setLog(Array.isArray(logdata?.list) ? logdata.list : []);
      setLogtotal(logdata.pagination.total as number);

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
    } catch (e: any) {
      showSnack({
        text: `ผิดพลาด${
          e?.message ? ` : ${e.message}` : "โหลดข้อมูลไม่สำเร็จ"
        }`,
        variant: "error",
      });
      Alert.alert("โหลดข้อมูลไม่สำเร็จ", "กลับไปหน้าหลัก", [
        {
          text: "ตกลง",
          onPress: () => router.back(),
        },
      ]);
    } finally {
      setLoadingdata(false);
    }
  }, [roomId, loglimit]);

  // โหลด Profile
  const loadUser = async () => {
    try {
      const { user } = await profile();
      setUserlevel(user.level);
      if (user.plan === "premium") {
        return setVip(true);
      }
    } catch (e: any) {
      showSnack({
        text: `ผิดพลาด${
          e?.message ? ` : ${e.message}` : "โหลดข้อมูลไม่สำเร็จ"
        }`,
        variant: "error",
      });
    }
  };

  // เริ่มโหลดครั้งแรก
  useEffect(() => {
    load();
    loadUser();
  }, [load]);

  // ดู log เพิ่มเติม
  const logmore = () => {
    setLoglimit(loglimit + 5);
  };

  // โพลลิ่งทุก 10 วินาที (รีเฟรชหน้าจออัตโนมัติ)
  useEffect(() => {
    const t = setInterval(() => load(), 10000);
    return () => clearInterval(t);
  }, [load]);

  // โหลดรายชื่อเพื่อน เพื่อ เชิญเพื่อน
  const loadFriends = useCallback(async () => {
    setOnInvitedFriend(true);
    setLoadfriend(true);
    try {
      const items = await getFriendAvailable({ q, room_id: roomId });
      setFriendsData(items);
    } catch (e: any) {
      showSnack({
        text: `ผิดพลาด${
          e?.message ? ` : ${e.message}` : "โหลดรายชื่อเพื่อนไม่สำเร็จ"
        }`,
        variant: "error",
      });
    } finally {
      setLoadfriend(false);
    }
  }, [q, roomId]);

  useEffect(() => {
    if (!isMember) return;
    loadFriends();
  }, [loadFriends]);

  // เชิญเพื่อน ส่ง Push Notification
  const invited_friend = useCallback(
    async (friend: any, data: RoomPayload) => {
      try {
        if (!friend.device_token) return;
        setLoadingMap((prev) => ({ ...prev, [friend.id]: true }));
        const message = {
          to: friend.device_token,
          sound: "default",
          title: `เพื่อนของคุณ ${data?.room?.owner?.username} ทำการเชิญคุณเข้าร่วมห้อง ${data?.room?.boss}`,
          body: `เข้าร่วมห้องบอสเลยตอนนี้`,
          data: {
            type: "invite_room",
            room_id: roomId,
            url: `pogopartyth://rooms/${roomId}`,
          },
        };
        const res = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Accept-encoding": "gzip, deflate",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(message),
        });
        const payload = {
          room_id: roomId,
          type: "invite",
          target: friend.username,
          description: "ทำการเชิญเพื่อนเข้าร่วมห้อง",
        };
        await RoomLog(payload);
        await load();

        setInvitedMap((prev) => ({
          ...prev,
          [friend.id]: true, // <-- ใช้ friend.id เป็น key (ต้องแน่ใจว่ามี id)
        }));
      } catch (err: any) {
        Alert.alert("เชิญเพื่อนไม่สำเร็จ", err?.message || "ลองใหม่อีกครั้ง");
      } finally {
        setLoadingMap((prev) => ({ ...prev, [friend.id]: false }));
      }
    },
    [roomId]
  );

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
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // --- ฟังก์ชันจัดการต่าง ๆ ---

  // // หมดเวลาห้อง noti แจ้งเจ้าของห้อง ว่าห้องตัวเอง หมดเวลาแล้วนะ
  // const noti_expire = async () => {
  //   try {
  //     const message = {
  //       to: data.room.owner.device_token,
  //       sound: "default",
  //       title: `ห้องของคุณหมดเวลาแล้ว`,
  //       body: `ห้องของคุณหมดเวลาแล้ว`,
  //       data: {
  //         type: "expire_room",
  //         room_id: roomId,
  //         url: `pogopartyth://rooms/${roomId}`,
  //       },
  //     };
  //     const res = await fetch("https://exp.host/--/api/v2/push/send", {
  //       method: "POST",
  //       headers: {
  //         Accept: "application/json",
  //         "Accept-encoding": "gzip, deflate",
  //         "Content-Type": "application/json",
  //       },
  //       body: JSON.stringify(message),
  //     });
  //     console.log("loaded friends:", res);
  //   } catch (err: any) {
  //     Alert.alert("เชิญเพื่อนไม่สำเร็จ", err?.message || "ลองใหม่อีกครั้ง");
  //   }
  // };

  // เข้าร่วมห้อง
  const onJoinLeave = async () => {
    if (isMember && !isOwner) {
      // ถ้าเป็นสมาชิก แต่ไม่ใช้หัวห้อง
      setExitRoom(true);
      return;
    } else if (room.lock_room && !isMember && !isOwner) {
      // ถ้าห้อง ล็อค ไม่ใช้หัวห้อง และ ไม่ใส่สมาชิก
      setOnPassword(true);
      return;
    } else if (userlevel < room.min_level) {
      // เวเวลมากกว่า ที่ห้องตั้งไว้
      showSnack({
        text: "ไม่สามารถเข้าร่วมได้ เวเวลไม่พอ",
        variant: "error",
      });
      return;
    } else if (room.vip_only && !vip) {
      // ถ้าห้องเฉพาะ VIP และ โปรไฟล์ ไม่เป็น VIP
      showSnack({
        text: "เฉพาะผู้ใช้ VIP เท่านั้น",
        variant: "error",
      });
      router.push("/package/premium_plan");
      return;
    } else if (room.special && !vip) {
      // ถ้าบอสเป็น special และ ไม่ใช้ VIP
      setOnCooldown(true);
      cooldown();
      return;
    }
    onJoinRoom();
  };

  // เช็ครหัสผ่าน
  const checkPassword = async () => {
    if (passwordRoom === room.password_room) {
      setOnPassword(false);

      // Check Level
      if (userlevel < room.min_level) {
        setPasswordRoom("");
        showSnack({
          text: "ไม่สามารถเข้าร่วมได้ เวเวลไม่พอ",
          variant: "error",
        });
        return;
      }
      // Check VIP
      else if (room.vip_only && !vip) {
        setPasswordRoom("");
        showSnack({
          text: "เฉพาะผู้ใช้ VIP เท่านั้น",
          variant: "error",
        });
        router.push("/package/premium_plan");
        return;
      }
      // ✅ Check Special Boss (เพิ่มตรงนี้)
      else if (room.special && !vip) {
        setOnCooldown(true);
        cooldown();
        return;
      }

      onJoinRoom();
      return;
    }
    showSnack({
      text: passwordRoom ? "รหัสผ่านไม่ถูกต้อง" : "กรุณาระบุรหัสผ่าน",
      variant: "error",
    });
    return;
  };

  // เข้าร่วมห้อง
  const onJoinRoom = async () => {
    try {
      setLoading(true);
      await joinRoom(room.id);
      const payload = {
        room_id: room.id,
        type: "join",
        target: "",
        description: "เข้าร่วมห้อง",
      };
      await RoomLog(payload);
      await load();
      setJoinModal(true);
      showSnack({ text: "เข้าห้องแล้ว", variant: "success" });
      setLoading(false);
    } catch (e: any) {
      showSnack({ text: e.message, variant: "error" });
      await load();
    } finally {
      setLoading(false);
      setOnCooldown(false);
    }
  };

  // ออกจากห้อง (สมาชิกธรรมดา)
  const onExitroom = async () => {
    try {
      setLoadingExit(true);
      if (isMember && !isOwner) await leaveRoom(room.id);
      else if (!isMember) await joinRoom(room.id);
      const payload = {
        room_id: room.id,
        type: "leave",
        target: "",
        description: "ออกจากห้อง",
      };
      await RoomLog(payload);
      showSnack({ text: "ออกจากห้องแล้ว", variant: "success" });
      setExitRoom(false);
      await load();
    } catch (e: any) {
      showSnack({ text: e.message, variant: "error" });
    } finally {
      setLoadingExit(false);
      setJoinModal(false);
    }
  };

  // คัดลอกชื่อผู้เล่น
  const copyUsernames = async () => {
    try {
      const names = members
        .filter((m) => m.role !== "owner")
        .map((m) => m.username || `User#${m.user_id}`);
      await Clipboard.setStringAsync(names.join(", "));
      setCopied(true);
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
      variant: "info",
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
      showSnack({ text: "เพิ่มเพื่อนแล้ว", variant: "success" });
      if (!next) {
        // ถ้าเปลี่ยนเป็นยังไม่เพิ่มเพื่อน ให้รีเฟรชสถานะจากเซิร์ฟเวอร์อีกที
        showSnack({ text: "ยกเลิกการเพิ่มเพื่อนแล้ว", variant: "info" });
        await load();
      }
    } catch (e: any) {
      setFriendAdded((m) => ({ ...m, [uid]: prev })); // revert
      showSnack({ text: e.message, variant: "error" });
    }
  };

  // ยกเลิกห้อง → เปลี่ยนสถานะเป็น canceled
  const onCanceled = async () => {
    const selectedCancel = ReasonCancel.find((rc) => rc.id === cancelReasonId);
    try {
      setForseReview(true);
      const payload = {
        room_id: room.id,
        reason: cancelOther
          ? cancelCustomReason.trim()
          : selectedCancel?.reasoncancel || "",
      };
      await CancelRoom(payload);
      const payloadLog = {
        room_id: room.id,
        type: "cancel",
        target: cancelOther
          ? cancelCustomReason.trim()
          : selectedCancel?.reasoncancel || "",
        description: "ยกเลิกห้อง",
      };
      await RoomLog(payloadLog);
      showSnack({ text: "ยกเลิกห้องแล้วเรียบร้อย", variant: "success" });
      router.back();
    } catch (e: any) {
      showSnack({ text: e.message, variant: "error" });
    } finally {
      setForseReview(false);
      setCancelRoomModal(false);
    }
  };

  // ปิดห้องเนื่องจากหมดเวลา → เปลี่ยนสถานะเป็น close
  const onClosed = async () => {
    try {
      setLoadingClose(true);
      await updateStatus(room.id, "closed");
      showSnack({ text: "ปิดห้องเรียบร้อย", variant: "success" });
      router.back();
    } catch (e: any) {
      showSnack({ text: e.message, variant: "error" });
    } finally {
      setLoadingClose(false);
    }
  };

  // เตะสมาชิกออกจากห้อง
  const onKickMember = async (userId: number) => {
    try {
      setLoadingKick(true);
      await kickMember(room.id, userId);
      showSnack({
        text: "เตะสมาชิกออกจากห้องแล้วเรียบร้อย",
        variant: "success",
      });
      setLoadingKick(false);
      setKickmember(false);
      await load();
    } catch (e: any) {
      showSnack({ text: e.message, variant: "error" });
    } finally {
      setLoadingKick(false);
      setKickmember(false);
    }
  };

  // เชิญในเกม → เปลี่ยนสถานะเป็น invited
  const onInvite = async () => {
    try {
      setLoading(true);
      await updateStatus(room.id, "invited");
      const payload = {
        room_id: room.id,
        type: "invite",
        target: "",
        description: "เชิญในเกมแล้ว",
      };
      await RoomLog(payload);
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
      setLoadingSaveReview(true);
      await reviewRoom(room.id, rating, "Raid success");
      const payload = {
        room_id: room.id,
        type: "review",
        target: `${rating} ดาว`,
        description: "ทำการรีวิวแล้ว ตีบอสสำเร็จ",
      };
      await RoomLog(payload);
      setForseReview(false);
      setRatingModal(false);
      showSnack({ text: "บันทึกรีวิวเรียบร้อย", variant: "success" });
      await load();
      router.back();
    } catch (e: any) {
      showSnack({ text: e.message, variant: "error" });
    } finally {
      setLoadingSaveReview(false);
      setForseReview(false);
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
      setLoadingSaveReview(true);
      // จะ setFailReason(reasonText) ด้วยก็ได้ ถ้าต้องเก็บ state นี้ไว้ใช้อย่างอื่น
      await reviewRoom(room.id, 1, `FAILED: ${reasonText}`);
      const payload = {
        room_id: room.id,
        type: "review",
        target: reasonText,
        description: `ทำการรีวิวแล้ว ตีบอสไม่สำเร็จ`,
      };
      await RoomLog(payload);
      setForseReview(false);
      setFailureModal(false);
      showSnack({ text: "บันทึกเหตุผลเรียบร้อย", variant: "success" });
      await load();
      router.back();
    } catch (e: any) {
      showSnack({ text: e.message, variant: "error" });
    } finally {
      setLoadingSaveReview(false);
      setForseReview(false);
    }
  };

  // เช็คก่อนปิดโมดัลเข้าร่วมห้อง
  const KickAndCancel = async () => {
    if (!isMember && !isOwner) {
      setJoinModal(false);
    } else {
      onExitroom();
    }
  };

  // --- ตัวแปรช่วย ---
  const { room, you } = data;
  const isMember = you?.is_member;
  const isOwner = you?.is_owner;

  const members = data.members;
  const nonOwnerMembers = members.filter((m) => m.role !== "owner");
  const allAdded =
    nonOwnerMembers.length > 0 &&
    nonOwnerMembers.every(
      (m) => friendAdded[m.user_id] ?? m.friend_ready === 1
    );
  const joinFull = data.room.max_members === members.length && !isMember; // เข้าห้องเต็ม
  const joinFulled = data.room.max_members === members.length;

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
          <View style={{ marginRight: 12 }}>
            <BossImage
              pokemon_image={room?.pokemon_image}
              boss_type={room?.boss_type}
              width={92}
              height={92}
              borderRadius={12}
              iconheight={30}
              iconwidth={30}
            />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={styles.title}>
                {room.boss} #{room.id}
              </Text>
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
                    { color: "#1E3A8A", fontFamily: "KanitSemiBold" },
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

        {/* รายละเอียดห้อง */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ข้อมูลห้อง</Text>
          <View style={styles.roomRow}>
            {/* เลเวลขั้นต่ำ */}
            {room.min_level && (
              <View style={[styles.roomBage, { backgroundColor: "#ef5a04ff" }]}>
                <Text style={{ fontFamily: "KanitMedium", color: "#ffffffff" }}>
                  เลเวลขั้นต่ำ {room.min_level}+
                </Text>
              </View>
            )}

            {/* เฉพาะ VIP */}
            {room.vip_only && (
              <View
                style={[
                  styles.roomBage,
                  {
                    backgroundColor: "#7d04efff",
                    flexDirection: "row",
                    gap: 4,
                    alignItems: "center",
                  },
                ]}
              >
                <Ionicons name="sparkles" size={12} color="#ffc400ff" />
                <Text style={{ fontFamily: "KanitMedium", color: "#ffc400ff" }}>
                  เฉพาะ VIP
                </Text>
              </View>
            )}

            {/* ล็อคห้อง */}
            {room.lock_room && (
              <View
                style={[
                  styles.roomBage,
                  {
                    backgroundColor: "#ebebebff",
                    flexDirection: "row",
                    gap: 8,
                  },
                ]}
              >
                <Ionicons name="bag" size={18} color="#3066dbff" />
                <Text style={{ fontFamily: "KanitMedium", color: "#666666" }}>
                  ห้องส่วนตัว
                </Text>
              </View>
            )}

            {/* รหัสผ่านห้อง */}
            {room.password_room && isMember && (
              <View style={[styles.roomBage, { backgroundColor: "#d6882eff" }]}>
                <Text style={{ fontFamily: "KanitMedium", color: "#ffffffff" }}>
                  รหัส : {room.password_room}
                </Text>
              </View>
            )}

            {/* บอส Special */}
            {room.special ? (
              <View
                style={[
                  styles.roomBage,
                  {
                    backgroundColor: "#1bad23ff",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  },
                ]}
              >
                <>
                  <Ionicons name="paw" color="#ffffff" size={14} />
                  <Text style={{ fontFamily: "KanitMedium", color: "#ffffff" }}>
                    Special Boss
                  </Text>
                </>
              </View>
            ) : null}
          </View>

          {/* ชื่อ และ รหัสหัวห้อง */}
          <Text style={styles.sectionTitle}>รหัสเพิ่มเพื่อนหัวห้อง</Text>
          <View style={styles.friendRow}>
            <View
              style={{ flexDirection: "row", gap: 5, alignItems: "center" }}
            >
              <Text style={styles.friendCodeText}>
                {isMember
                  ? formatFriendCode(room.owner?.friend_code || "-")
                  : "-"}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>ข้อมูลบอส</Text>

          {/* ข้อมูลบอส CP Normal */}
          <View style={styles.infoRow}>
            <View
              style={{ flexDirection: "row", gap: 5, alignItems: "center" }}
            >
              <Text style={styles.friendText}>CP (Normal)</Text>
              <Text style={styles.cptext}>
                {room.raid_boss
                  ? `${room.raid_boss.combat_power.normal.min} - ${room.raid_boss.combat_power.normal.max}`
                  : "-"}
              </Text>
            </View>
          </View>

          {/* ข้อมูลบอส CP Boosted */}
          <View style={styles.infoRow}>
            <View
              style={{ flexDirection: "row", gap: 5, alignItems: "center" }}
            >
              <Text style={styles.friendText}>CP (Boosted)</Text>
              <Text style={styles.cptext}>
                {room.raid_boss
                  ? `${room.raid_boss.combat_power.boosted.min} - ${room.raid_boss.combat_power.boosted.max}`
                  : "-"}
              </Text>
            </View>
          </View>

          {/* ปุ่มแชร์ห้อง */}
          {isMember && room.status === "active" && (
            <ShareRoom roomId={room.id} />
          )}

          {/* ปุ่มเปิดเกม Pokemon Go */}
          {isMember &&
          room.status !== "closed" &&
          room.status !== "canceled" ? (
            <TouchableOpacity
              onPress={openPokemonGo}
              style={[styles.outlineBtn, { backgroundColor: "#d34228ff" }]}
            >
              <Image
                source={{ uri: PokemonGoIcon }}
                style={{
                  width: 18,
                  height: 18,
                  marginRight: 6,
                  borderRadius: 4,
                }}
              />
              <Text style={styles.modalBtnText}>เปิด Pokemon Go</Text>
            </TouchableOpacity>
          ) : null}

          {/* เจ้าของ -> คัดลอกชื่อผู้เล่น */}
          {isOwner && room.status !== "closed" ? (
            <TouchableOpacity
              onPress={copyUsernames}
              style={[
                styles.outlineBtn,
                { backgroundColor: allAdded ? "#2563EB" : "#9ab3e9ff" },
              ]}
              disabled={!allAdded}
            >
              {copied ? (
                <Ionicons name="checkmark" size={18} color="#ffffffff" />
              ) : (
                <Ionicons name="copy-outline" size={16} color="#ffffffff" />
              )}
              <Text style={styles.outlineBtnText}>
                {allAdded
                  ? "คัดลอกรายชื่อผู้เล่น"
                  : "รอสมาชิกเข้าร่วมและเพิ่มเพื่อน...."}
              </Text>
            </TouchableOpacity>
          ) : null}

          {/* สมาชิก (ไม่ใช่เจ้าของ) -> คัดลอกรหัสหัวห้อง */}
          {isMember && !isOwner && room.status !== "closed" ? (
            <TouchableOpacity
              onPress={copyFriendCode}
              style={styles.outlineBtn}
            >
              <Ionicons name="copy-outline" size={16} color="#ffffffff" />
              <Text style={styles.outlineBtnText}>คัดลอกรหัสหัวห้อง</Text>
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
              // หัวห้อง?
              const isOwnerRow = m.role === "owner";

              // แถวของตัวเอง?
              const iAmThisMember = m.user_id === data.you?.user_id;

              // ตัวเองเป็นหัวห้องหรือไม่
              const owner = data.you?.is_owner && !isOwnerRow;

              // เข้าร่วมไหม
              const joined = data.you?.is_member;

              // สถานะห้อง = เชิญแล้ว
              const isInvited = room.status === "invited";

              // สถานห้อง = ปิดห้อง
              const isClosed = room.status === "closed";

              // หัวห้องเตะสมาชิกได้ ตอน ห้องถูกเชิญ
              const onCkickMember = owner && !isInvited && !isClosed;

              // โชว์ปุ่มเฉพาะ "ไม่ใช่หัวห้อง"
              const showBtn = !isOwnerRow && joined && !isInvited && !isClosed;

              // สถานะ "เพิ่มเพื่อนแล้ว" (ใช้ค่าที่ sync กับ server ถ้าไม่มีใช้ local)
              const added = Boolean(
                friendAdded[m.user_id] ?? m.friend_ready === 1
              );

              // ✅ กดได้เฉพาะแถวของตัวเอง และไม่อยู่สถานะที่ไม่ให้กด
              const disabledBtn = !iAmThisMember || isInvited || expired;

              // สมาชิกรีวิวห้อง
              const isReview = m.is_review === 1 && (isInvited || isClosed);
              const isWaitReview = m.is_review === 0 && isInvited;

              const teamColor =
                m.team === "Valor"
                  ? "#ef4444ff"
                  : m.team === "Mystic"
                  ? "#3b82f6ff"
                  : m.team === "Instinct"
                  ? "#ffc107"
                  : "#9CA3AF";

              const teamBackGroundColor =
                m.team === "Valor"
                  ? "#ffededff"
                  : m.team === "Mystic"
                  ? "#edf4ffff"
                  : m.team === "Instinct"
                  ? "#fffbefff"
                  : "#9CA3AF";

              return (
                <TouchableOpacity
                  key={m.user_id}
                  style={[
                    styles.memberItem,
                    iAmThisMember && {
                      backgroundColor: teamBackGroundColor, // ฟ้าอ่อน
                      borderColor: teamColor,
                      borderWidth: 1,
                    },
                  ]}
                  disabled={iAmThisMember} // กันกรณี user_id ว่าง (ไม่ควรเกิด)
                  onPress={() => router.push(`/friends/${m.user_id}`)}
                >
                  {/* Avatar */}
                  <AvatarComponent
                    avatar={m.avatar}
                    username={m.username}
                    plan={m.plan}
                    width={35}
                    height={35}
                    borderRadius={21}
                    fontsize={9}
                    iconsize={9}
                  />

                  <View style={{ flex: 1, marginLeft: 4 }}>
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
                          fontFamily: "KanitSemiBold",
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
                          backgroundColor: teamColor,
                          padding: 2,
                          paddingHorizontal: 4,
                          paddingVertical: 1,
                          borderRadius: 4,
                        }}
                      >
                        <Text
                          style={{
                            color: "#ffffffff",
                            fontSize: 12,
                            fontFamily: "KanitSemiBold",
                          }}
                        >
                          เลเวล {m.member_level}
                        </Text>
                      </View>
                    </View>

                    <Text
                      style={{
                        fontSize: 12,
                        color: "#6B7280",
                        fontFamily: "KanitMedium",
                      }}
                    >
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
                      />
                    </TouchableOpacity>
                  )}

                  {/* ปุ่มเตะสมาชิก */}
                  {onCkickMember && (
                    <TouchableOpacity
                      style={{
                        backgroundColor: "#da1f1fff",
                        padding: 9,
                        borderRadius: 8,
                        marginLeft: 3,
                      }}
                      onPress={() => setKickmember(m.user_id)}
                    >
                      <Ionicons name="close" color="#ffffffff" />
                    </TouchableOpacity>
                  )}

                  {/* สถานะรีวิว*/}
                  {isReview && (
                    <>
                      <Ionicons
                        name="checkmark-outline"
                        color="#50d444ff"
                        size={18}
                      />
                      <Text style={styles.review}>รีวิวแล้ว</Text>
                    </>
                  )}

                  {isWaitReview && (
                    <>
                      <Ionicons
                        name="ellipsis-vertical-outline"
                        color="#d48a44ff"
                        size={18}
                      />
                      <Text style={styles.review}>รอการรีวิว...</Text>
                    </>
                  )}
                </TouchableOpacity>
              );
            })
          ) : (
            <Text style={{ color: "#9CA3AF" }}>ยังไม่มีสมาชิก</Text>
          )}

          {/* ปุ่มเชิญเพื่อน */}
          {isMember && !joinFulled && room.status === "active" && (
            <TouchableOpacity
              onPress={loadFriends}
              style={[styles.outlineBtn, { backgroundColor: "#2563EB" }]}
            >
              <Ionicons name="people-outline" size={16} color="#ffffffff" />
              <Text style={styles.outlineBtnText}>เชิญเพื่อนของคุณ</Text>
            </TouchableOpacity>
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

        {/* Log */}
        {isMember && (
          <View
            style={[
              styles.sectionlog,
              { paddingBottom: loglimit < logtotal ? 14 : 0 },
            ]}
          >
            <View style={styles.lineRow}>
              <Text style={styles.sectionTitle}>ประวัติ ({logtotal})</Text>
            </View>
            {log.length > 0 ? (
              log.map((item) => {
                const icontype = iconType(item.type);
                const icontypecolor = logTypeColor(item.type);
                return (
                  <View
                    key={item.id}
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      borderBottomWidth: 1,
                      borderColor: "#f0f0f0ff",
                      paddingBottom: 8,
                      paddingTop: 8,
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => router.push(`/friends/${item.user_id}`)}
                      disabled={item.user_id === you.user_id}
                    >
                      <Image
                        source={{ uri: item.avatar ?? FALLBACK }}
                        style={styles.avatar}
                      />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          flex: 1,
                          justifyContent: "space-between",
                        }}
                      >
                        <View>
                          <Text style={{ fontFamily: "KanitSemiBold" }}>
                            {item.username}
                          </Text>
                        </View>
                        <View>
                          <Text
                            style={{
                              fontFamily: "KanitRegular",
                              color: "#949494ff",
                              fontSize: 12,
                            }}
                          >
                            {minutesAgoTH(item.created_at)}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: "KanitMedium",
                            fontSize: 13,
                            color: icontypecolor ? icontypecolor : "#252525ff",
                          }}
                        >
                          {item.description}
                        </Text>

                        {icontype && icontypecolor && (
                          <Ionicons name={icontype} color={icontypecolor} />
                        )}

                        {item.target && (
                          <Text
                            style={{
                              fontFamily: "KanitSemiBold",
                              fontSize: 13,
                            }}
                          >
                            {item.target}
                          </Text>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })
            ) : (
              <Text style={{ fontFamily: "KanitRegular", fontSize: 13 }}>
                ไม่มีข้อมูลการบันทึก
              </Text>
            )}
            {loglimit < logtotal && (
              <View>
                <TouchableOpacity style={styles.outlineBtn} onPress={logmore}>
                  {loadingdata ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text style={styles.outlineBtnText}>
                      ดูประวัติเพิ่มเติม
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* แถบปุ่มคงที่ด้านล่าง */}
      <View
        onLayout={(e) => setFooterH(e.nativeEvent.layout.height)}
        style={[
          styles.footerBar,
          { paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        {/* ปุ่มแชท */}
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

        {/* ปุ่มเชิญในเกม */}
        {isOwner && allAdded && room.status == "active" ? (
          <TouchableOpacity
            onPress={onInvite}
            style={[styles.primaryBtn, { backgroundColor: "#2563EB" }]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <>
                <Ionicons name="send-outline" size={18} color="#fff" />
                <Text style={styles.primaryBtnText}>เชิญในเกม</Text>
              </>
            )}
          </TouchableOpacity>
        ) : null}

        {/* ปุ่มตีบอสเสร็จ */}
        {room.status === "invited" && isMember && !you.is_review ? (
          <TouchableOpacity
            onPress={onBattleFinished}
            style={[styles.primaryBtn, { backgroundColor: "#10B981" }]}
          >
            <Ionicons name="flag-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>ตีบอสเสร็จ กด (รีวิว)</Text>
          </TouchableOpacity>
        ) : null}

        {/* ปุ่มยกเลิกห้อง */}
        {room.current_members < 2 && isOwner && room.status === "active" && (
          <TouchableOpacity
            onPress={onCanceledRoom}
            style={[styles.primaryBtn, { backgroundColor: "#d0444bff" }]}
          >
            <Ionicons name="close-outline" size={18} color="#fff" />
            <Text style={styles.primaryBtnText}>ยกเลิกห้อง</Text>
          </TouchableOpacity>
        )}

        {/* ปุ่มเข้าร่วมห้อง / ออกจากห้อง */}
        {!isOwner && room.status !== "invited" && room.status !== "closed" ? (
          <TouchableOpacity
            onPress={onJoinLeave}
            disabled={
              loading ||
              expired ||
              joinFull ||
              room.status === "canceled" ||
              room.status === "closed"
            }
            style={[
              styles.primaryBtn,
              {
                backgroundColor: isMember ? "#EF4444" : "#10B981",
                opacity:
                  expired ||
                  joinFull ||
                  room.status === "canceled" ||
                  room.status === "closed"
                    ? 0.5
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
              onPress={() => {
                setCancelRoomModal(true);
                setCanceledRoom(false);
              }}
              style={[styles.modalBtn, { backgroundColor: "#d0444bff" }]}
            >
              <Ionicons name="close-outline" size={18} color="#fff" />
              <Text style={styles.modalBtnText}>ยกเลิกห้อง</Text>
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

      {/* Modal: เหตุผลยกเลิกห้อง */}
      <Modal
        visible={cancelRoomModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setCancelRoomModal(false);
          setCancelReasonId(null);
          setCancelCustomReason("");
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
            }}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>เหตุผลที่ยกเลิกห้อง</Text>

              {/* ตัวเลือกเหตุผลแบบรายการ */}
              <View style={{ gap: 8, marginBottom: 8 }}>
                {ReasonCancel.map((rc) => {
                  const selected = rc.id === cancelReasonId;
                  return (
                    <TouchableOpacity
                      key={rc.id}
                      onPress={() => setCancelReasonId(rc.id)}
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
                          selected && {
                            color: "#111827",
                            fontFamily: "KanitSemiBold",
                          },
                        ]}
                      >
                        {rc.reasoncancel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* เลือก "อื่นๆ" แล้วค่อยแสดงช่องกรอก */}
              {cancelOther && (
                <TextInput
                  value={cancelCustomReason}
                  onChangeText={setCancelCustomReason}
                  placeholder="โปรดระบุเหตุผล"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  style={[
                    styles.textArea,
                    { marginTop: 4, fontFamily: "KanitMedium" },
                  ]}
                />
              )}

              <TouchableOpacity
                onPress={onCanceled}
                disabled={!canCancel}
                style={[
                  styles.modalBtn,
                  { backgroundColor: "#111827" },
                  !canCancel && styles.modalBtnDisabled,
                ]}
                accessibilityState={{ disabled: !canCancel }}
              >
                {loadingSaveReview ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalBtnText}>บันทึก</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => {
                  setCancelRoomModal(false);
                  setCancelReasonId(null);
                  setCancelCustomReason("");
                }}
                style={[styles.modalBtn, styles.modalCancel]}
              >
                <Text style={[styles.modalBtnText, { color: "#111827" }]}>
                  ยกเลิก
                </Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
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
              {loadingExit ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalBtnText}>ออกจากห้อง</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setExitRoom(false)}
              style={[styles.modalBtn, styles.modalCancel]}
            >
              <Text style={[styles.modalBtnText, { color: "#111827" }]}>
                อยู่ต่อ
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: เตะ */}
      <Modal
        visible={kickmember !== false}
        transparent
        animationType="fade"
        onRequestClose={() => setKickmember(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>ต้องการเตะผู้เข้าร่วมนี้ ?</Text>
            <TouchableOpacity
              onPress={() => {
                if (kickmember !== false) {
                  onKickMember(kickmember);
                }
              }}
              style={[styles.modalBtn, { backgroundColor: "#EF4444" }]}
            >
              {loadingKick ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalBtnText}>เตะ</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setKickmember(false)}
              style={[styles.modalBtn, styles.modalCancel]}
            >
              <Text style={[styles.modalBtnText, { color: "#111827" }]}>
                ยกเลิก
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: หมดเวลา */}
      <Modal
        visible={expired && room.status === "active"}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>เวลาห้องนี้หมดลงแล้ว!</Text>
            <TouchableOpacity
              onPress={onClosed}
              style={[styles.modalBtn, styles.modalCancel]}
            >
              {loadingClose ? (
                <ActivityIndicator size="small" color="#111827" />
              ) : (
                <Text style={[styles.modalBtnText, { color: "#111827" }]}>
                  กลับ
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: นับเวลาถอยหลังเข้าห้อง */}
      <Modal visible={onCooldown} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <Text style={{ fontFamily: "KanitSemiBold", fontSize: 16 }}>
                ผู้ใช้
              </Text>
              <View
                style={{
                  backgroundColor: "#EFBF04",
                  paddingHorizontal: 8,
                  borderRadius: 4,
                }}
              >
                <Text
                  style={{
                    fontFamily: "KanitSemiBold",
                    fontSize: 16,
                    color: "#666666",
                  }}
                >
                  Premium
                </Text>
              </View>
              <Text style={{ fontFamily: "KanitSemiBold", fontSize: 16 }}>
                จะสามารถเข้าห้องได้ก่อน 10 วินาที
              </Text>
            </View>

            {!onJoin && (
              <View style={{ alignItems: "center", padding: 8 }}>
                <Text
                  style={{
                    fontSize: 40,
                    fontFamily: "KanitSemiBold",
                    color: "#414141ff",
                  }}
                >
                  {String(left).padStart(2)}
                </Text>
              </View>
            )}

            {onJoin && (
              <TouchableOpacity
                onPress={onJoinRoom}
                style={[styles.modalBtn, { backgroundColor: "#10B981" }]}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffffff" />
                ) : (
                  <Text style={[styles.modalBtnText, { color: "#ffffffff" }]}>
                    เข้าร่วม
                  </Text>
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              onPress={() => {
                router.push("/package/premium_plan");
              }}
              style={[styles.modalBtn, { backgroundColor: "#EFBF04" }]}
            >
              <Text style={[styles.modalBtnText, { color: "#414141ff" }]}>
                สมัคร Premium
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setOnCooldown(false);
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

      {/* Modal: ระบุรหัสผ่านห้อง กรณีห้อง ล็อค */}
      <Modal
        visible={onPassword && room.status === "active"}
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>กรุณาระบุรหัสผ่านห้อง</Text>
            <TextInput
              placeholder="อย่างน้อย 6 ตัวอักษร"
              placeholderTextColor="#9CA3AF"
              value={passwordRoom}
              onChangeText={setPasswordRoom}
              secureTextEntry
              style={{
                paddingVertical: 10,
                paddingHorizontal: 12,
                color: "#000000ff",
                fontSize: 14,
                fontFamily: "KanitRegular",
                borderWidth: 1,
                borderColor: "#dbdbdbff",
                borderRadius: 8,
              }}
            />
            {passwordRoom && passwordRoom.length < 6 && (
              <Text
                style={{
                  fontFamily: "KanitRegular",
                  fontSize: 12,
                  color: "red",
                  marginLeft: 2,
                }}
              >
                อย่างน้อย 6 ตัวอักษร
              </Text>
            )}
            <TouchableOpacity
              onPress={checkPassword}
              style={[
                styles.modalBtn,
                {
                  backgroundColor: "#10B981",
                  opacity: passwordRoom.length < 6 ? 0.6 : 1,
                },
              ]}
              disabled={passwordRoom.length < 6}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#111827" />
              ) : (
                <Text style={[styles.modalBtnText, { color: "#ffffffff" }]}>
                  ยืนยัน
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                setOnPassword(false);
                setPasswordRoom("");
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

      {/* Modal: หมดเวลา และ เชิญแล้ว รอ รีวิว */}
      <Modal
        visible={
          expired && room.status === "invited" && forseReview && !you.is_review
        }
        transparent
        animationType="fade"
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              เวลาห้องนี้หมดลงแล้ว คุณต้องทำการ รีวิว ห้องนี้
            </Text>
            <TouchableOpacity
              onPress={async () => {
                setResultModal(true);
                setForseReview(false);
              }}
              style={[styles.modalBtn, { backgroundColor: "#10B981" }]}
            >
              {loadingClose ? (
                <ActivityIndicator size="small" color="#ffffffff" />
              ) : (
                <Text style={[styles.modalBtnText, { color: "#ffffffff" }]}>
                  รีวิวตอนนี้
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: เลือกผลลัพธ์ */}
      <Modal
        visible={resultModal && room.status === "invited" && isMember}
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
            {!expired && (
              <TouchableOpacity
                onPress={() => setResultModal(false)}
                style={[styles.modalBtn, styles.modalCancel]}
              >
                <Text style={[styles.modalBtnText, { color: "#111827" }]}>
                  ยกเลิก
                </Text>
              </TouchableOpacity>
            )}
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
              {loadingSaveReview ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.modalBtnText}>บันทึก</Text>
              )}
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
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={{
              flex: 1,
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
            }}
          >
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
                          selected && {
                            color: "#111827",
                            fontFamily: "KanitSemiBold",
                          },
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
                  style={[
                    styles.textArea,
                    { marginTop: 4, fontFamily: "KanitMedium" },
                  ]}
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
                {loadingSaveReview ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.modalBtnText}>บันทึก</Text>
                )}
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
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Modal: เข้าร่วม คัดลอกรหัสเพิ่มเพื่อน */}
      <Modal
        visible={joinModal}
        transparent
        animationType="fade"
        onRequestClose={() => setJoinModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>เข้าร่วมห้องบอส</Text>
            <Text
              style={{
                color: "#374151",
                textAlign: "center",
                fontSize: 14,
                fontFamily: "KanitMedium",
              }}
            >
              กรุณาเพิ่มเพื่อนหัวห้องด้วย Friend Code
            </Text>
            <Text
              style={{
                color: "#374151",
                textAlign: "center",
                fontWeight: "700",
                marginVertical: 8,
                fontSize: 24,
              }}
            >
              {formatFriendCode(room.owner?.friend_code || "-")}
            </Text>
            <TouchableOpacity
              onPress={copyFriendCode}
              style={[styles.modalBtn, { backgroundColor: "#2563EB" }]}
            >
              <Ionicons name="copy-outline" size={18} color="#fff" />
              <Text style={styles.modalBtnText}>
                คัดลอกรหัสเพิ่มเพื่อนหัวห้อง
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={openPokemonGo}
              style={[styles.modalBtn, { backgroundColor: "#d34228ff" }]}
            >
              <Image
                source={{ uri: PokemonGoIcon }}
                style={{
                  width: 18,
                  height: 18,
                  marginRight: 6,
                  borderRadius: 4,
                }}
              />
              <Text style={styles.modalBtnText}>เปิด Pokemon Go</Text>
            </TouchableOpacity>

            {/* ปุ่มเพิ่มเพื่อนแล้ว สำหรับผู้ใช้ตัวเอง (ย้ายมาหลังปุ่มเปิดเกม) */}
            <TouchableOpacity
              onPress={async () => {
                const myId = data.you?.user_id;
                setLoadingAdd(true);
                await toggleFriend(myId);
                // โหลดข้อมูลใหม่ทันที
                await load();
                // ปิด modal หลังทำงานสำเร็จ
                setLoadingAdd(false);
                setJoinModal(false);
              }}
              style={[styles.modalBtn, { backgroundColor: "#10B981" }]}
              disabled={Boolean(friendAdded[data.you?.user_id || -1])}
            >
              {loadingAdd ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.modalBtnText}>เพิ่มเพื่อนแล้ว</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={KickAndCancel}
              style={[styles.modalBtn, styles.modalCancel]}
            >
              {loadingExit ? (
                <ActivityIndicator size="small" color="#111827" />
              ) : (
                <Text style={[styles.modalBtnText, { color: "#111827" }]}>
                  ยกเลิก
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: เชิญเพื่อน */}
      <Modal
        visible={onInvitedFriend}
        transparent
        animationType="slide"
        onRequestClose={() => setOnInvitedFriend(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            {/* header bar */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <Text style={{ fontFamily: "KanitSemiBold", fontSize: 16 }}>
                เชิญเพื่อน
              </Text>
              <TouchableOpacity
                onPress={() => setOnInvitedFriend(false)}
                style={styles.iconBtn}
              >
                <Ionicons name="close" size={20} color="#111827" />
              </TouchableOpacity>
            </View>

            {/* search bar */}
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={18} color="#6B7280" />
              <TextInput
                placeholder="ค้นหาชื่อเพื่อนของคุณ"
                placeholderTextColor="#9CA3AF"
                value={q}
                onChangeText={setQ}
                onSubmitEditing={loadFriends}
                style={[styles.searchInput, { fontFamily: "KanitRegular" }]}
              />
              {q ? (
                <TouchableOpacity onPress={() => setQ("")}>
                  <Ionicons name="close-circle" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ) : null}
            </View>

            {loadfriend ? (
              <View style={{ padding: 16, alignItems: "center" }}>
                <ActivityIndicator />
              </View>
            ) : (
              <FlatList
                data={friendsData}
                keyExtractor={(x) => String(x.id)}
                renderItem={({ item }) => {
                  const invited = !!invitedMap[item.id]; // เช็คจาก invitedMap
                  const loading = !!loadingMap[item.id];
                  const teamColor =
                    item.team === "Valor"
                      ? "#ef4444ff"
                      : item.team === "Mystic"
                      ? "#3b82f6ff"
                      : item.team === "Instinct"
                      ? "#ffc107"
                      : "#9CA3AF";
                  return (
                    <View style={styles.itemRow}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <TouchableOpacity
                          onPress={() => {
                            router.push(`/friends/${item.id}`);
                          }}
                        >
                          {/* Avatar */}
                          <AvatarComponent
                            avatar={item.avatar}
                            username={item.username}
                            plan={item.plan}
                            width={48}
                            height={48}
                            borderRadius={999}
                            fontsize={10}
                          />
                        </TouchableOpacity>

                        <View>
                          <View style={{ flexDirection: "row", gap: 8 }}>
                            <Text
                              style={{
                                fontFamily: "KanitSemiBold",
                                color: "#111827",
                              }}
                            >
                              {item.username}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.levelBage,
                              { backgroundColor: teamColor },
                            ]}
                          >
                            <Text
                              style={{
                                fontSize: 12,
                                fontFamily: "KanitSemiBold",
                                color: "#ffffffff",
                              }}
                            >
                              เลเวล {item.level}
                            </Text>
                          </View>

                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Ionicons name="star" color="#dfaf11ff" />
                            <Text
                              style={{
                                fontFamily: "KanitMedium",
                                color: "#111827",
                              }}
                            >
                              {item.rating_owner ? item.rating_owner : "-"}
                            </Text>
                          </View>
                        </View>
                      </View>

                      {item.device_token && (
                        <View>
                          <TouchableOpacity
                            style={{
                              backgroundColor: "#2563EB",
                              paddingVertical: 6,
                              paddingHorizontal: 6,
                              borderRadius: 6,
                              flexDirection: "row",
                              alignItems: "center",
                              opacity: invited || loading ? 0.5 : 1,
                              minWidth: 100,
                              justifyContent: "center",
                            }}
                            onPress={() => {
                              invited_friend(item, data);
                            }}
                            disabled={invited}
                          >
                            {loading ? (
                              <ActivityIndicator color="#fff" size="small" />
                            ) : (
                              <Text
                                style={{
                                  fontFamily: "KanitMedium",
                                  color: "#ffffffff",
                                }}
                              >
                                {invited ? "เชิญแล้ว" : "เชิญเข้าร่วม"}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
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
                    ไม่พบข้อมูลเพื่อนคุณ
                  </Text>
                }
              />
            )}
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
    fontFamily: "KanitMedium",
    color: "#111827",
    marginRight: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  badgeText: { color: "#fff", fontFamily: "KanitSemiBold", fontSize: 12 },

  lineRow: { flexDirection: "row", alignItems: "center", marginTop: 6 },
  lineText: {
    color: "#374151",
    fontSize: 14,
    marginLeft: 6,
    fontFamily: "KanitMedium",
  },

  noteBox: {
    backgroundColor: "#F3F4F6",
    padding: 8,
    borderRadius: 10,
    marginTop: 8,
  },
  noteText: { color: "#4B5563", fontSize: 12, fontFamily: "KanitMedium" },

  section: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 12,
    marginBottom: 12,
  },

  sectionlog: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingLeft: 12,
    paddingRight: 12,
    paddingTop: 12,
  },

  sectionTitle: {
    fontSize: 16,
    fontFamily: "KanitSemiBold",
    color: "#111827",
    marginBottom: 8,
  },
  sectionTitleHowto: {
    fontSize: 16,
    fontFamily: "KanitSemiBold",
    color: "#111827",
  },
  friendRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 12,
  },
  infoRow: {
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 6,
  },
  friendText: {
    color: "#374151",
    fontSize: 14,
    alignItems: "center",
    fontFamily: "KanitMedium",
  },
  friendCodeText: {
    color: "#2b2b2bff",
    fontSize: 24,
    fontFamily: "KanitMedium",
  },

  outlineBtn: {
    marginTop: 10,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#2563EB",
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  outlineBtnText: { color: "#ffffffff", fontFamily: "KanitSemiBold" },

  memberItem: {
    backgroundColor: "#ffffffff",
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    marginBottom: 8,
    gap: 8,
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
    borderRadius: 8,
    borderWidth: 1,
  },
  smallBtnIdle: { backgroundColor: "#fff", borderColor: "#111827" },
  smallBtnDone: { backgroundColor: "#10B981", borderColor: "#10B981" },
  smallBtnText: { fontSize: 12, fontFamily: "KanitSemiBold", color: "#111827" },

  primaryBtn: {
    marginTop: 4,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: { color: "#fff", fontFamily: "KanitSemiBold", marginLeft: 8 },

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
    fontFamily: "KanitSemiBold",
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
  modalBtnText: { color: "#fff", fontFamily: "KanitSemiBold" },
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
    fontFamily: "KanitMedium",
  },
  modalBtnDisabled: {
    opacity: 0.5,
  },
  howtoDetail: {
    flex: 1,
    color: "#374151",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "KanitMedium",
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
    gap: 8,
  },
  meItem: {
    backgroundColor: "#E6F0FF", // ฟ้าอ่อน
    borderColor: "#60A5FA",
    borderWidth: 1,
  },
  review: {
    fontSize: 13,
    fontFamily: "KanitMedium",
    marginLeft: 4,
  },
  cptext: {
    color: "#374151",
    fontSize: 16,
    fontFamily: "KanitSemiBold",
  },
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
    height: 800,
  },
  iconBtn: {
    marginLeft: "auto",
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
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
  link: { color: "#2563EB", fontFamily: "KanitMedium" },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
    gap: 8,
    flex: 1,
    justifyContent: "space-between",
  },
  roomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  roomBage: {
    backgroundColor: "#123123",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
  levelBage: {
    padding: 2,
    width: 55,
    alignItems: "center",
    paddingVertical: 1,
    borderRadius: 4,
  },
});
