// RoomExpiredNoti.tsx (ส่วนที่สำคัญ)
import { useEffect, useRef, useCallback, useState } from "react";
import { Alert } from "react-native";

type RoomPayload = {
  room: {
    id: number;
    boss?: string | null;
    owner: { id: number; device_token?: string | null; username?: string };
  };
};

function isExpoPushToken(token?: string | null) {
  return !!token && /^ExponentPushToken\[\S+\]$/.test(token);
}

export function useNotifyRoomExpired(opts: {
  expired: boolean;           // true เมื่อห้องหมดเวลาแล้ว
  roomId: number;
  data: RoomPayload | null;
}) {
  const { expired, roomId, data } = opts;

  // กันยิงซ้ำต่อห้อง
  const sentRef = useRef<Record<number, boolean>>({});
  const [sending, setSending] = useState(false);

  const sendExpireNoti = useCallback(async () => {
    if (!data?.room?.owner?.device_token) return;
    const token = data.room.owner.device_token;
    if (!isExpoPushToken(token)) return;

    const message = {
      to: token,
      sound: "default",
      title: `ห้องบอส ${data?.room?.boss ?? ""} ของคุณหมดเวลาแล้ว`,
      body: `หมดเวลาแล้วนะ กดเพื่อไปดูรายละเอียด`,
      data: {
        type: "room_expired",
        room_id: roomId,
        url: `pogopartyth://rooms/${roomId}`,
      },
      priority: "high",
      ttl: 60 * 60, // 1 ชั่วโมง
      channelId: "default", // แนะนำตั้ง channel เดิมใน Android
    };

    setSending(true);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        // ✅ ส่งเป็น array รองรับขยายในอนาคต
        body: JSON.stringify([message]),
      });

      const json = await res.json();
      // ตัวอย่างโครงสร้าง: { data: [{ status: "ok", id: "XXXXXXXX" }] , errors?: [...] }
      const item = Array.isArray(json?.data) ? json.data[0] : null;

      if (item?.status === "ok") {
        sentRef.current[roomId] = true; // กันยิงซ้ำ
      } else {
        const msg =
          item?.message ||
          json?.errors?.[0]?.message ||
          "ส่งแจ้งเตือนไม่สำเร็จ (unknown)";
        throw new Error(msg);
      }
    } catch (e: any) {
      Alert.alert("ส่งแจ้งเตือนไม่สำเร็จ", e?.message || "ลองใหม่อีกครั้ง");
    } finally {
      setSending(false);
    }
  }, [data?.room?.owner?.device_token, data?.room?.boss, roomId]);

  // ยิงเมื่อ "เปลี่ยนสถานะ" เป็นหมดเวลา และยังไม่เคยส่ง
  useEffect(() => {
    if (expired && !sentRef.current[roomId]) {
      void sendExpireNoti();
    }
  }, [expired, roomId, sendExpireNoti]);

  return { sending, sentOnce: !!sentRef.current[roomId] };
}
