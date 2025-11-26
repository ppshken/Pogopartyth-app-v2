import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { getEventById, Events } from "../../lib/events";
import { Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams(); // รับ id และ title (ถ้าส่งมา)
  const [event, setEvent] = useState<Events | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchEvent() {
      if (!id) return;
      setLoading(true);
      try {
        // แปลง id เป็น string
        const eventId = Array.isArray(id) ? id[0] : id;
        const data = await getEventById(eventId);
        setEvent(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    fetchEvent();
  }, [id]);

  if (loading && !event) {
    return (
      <View style={styles.errorContainer}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* รูปภาพขนาดใหญ่ */}
        <Image
          source={{
            uri: event?.image || "https://via.placeholder.com/600x400",
          }}
          style={styles.image}
          resizeMode="cover"
        />

        <View style={styles.contentContainer}>
          {/* วันที่และผู้สร้าง */}
          <View style={styles.metaRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>News</Text>
            </View>
            {event?.created_at && (
              <Text style={styles.dateText}>
                {/* ตัวอย่าง format วันที่ */}
                {new Date(event.created_at).toLocaleDateString("th-TH", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </Text>
            )}
          </View>

          {/* หัวข้อ */}
          <Text style={styles.title}>{event?.title}</Text>

          <View style={styles.divider} />

          {/* เนื้อหา */}
          <Text style={styles.description}>{event?.description}</Text>

          {/* ส่วนของผู้เขียน (Optional) */}
          <View style={styles.authorContainer}>
            <Text style={styles.authorLabel}>โพสต์โดย:</Text>
            <Image
              source={{ uri: event?.creator_avatar }}
              style={styles.avatar}
            />
            <Text style={styles.authorName}>
              {event?.created_by || "Admin"}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#fff",
  },
  errorText: {
    fontFamily: "KanitSemiBold",
    fontSize: 18,
    color: "#374151",
    marginTop: 16,
  },
  subErrorText: {
    fontFamily: "KanitRegular",
    fontSize: 14,
    color: "#9CA3AF",
    marginTop: 8,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  image: {
    width: width,
    height: 250,
    backgroundColor: "#E5E7EB",
  },
  contentContainer: {
    padding: 20,
    marginTop: -20, // ดึงขึ้นมาทับรูปนิดนึงเพื่อให้ดูมีมิติ
    backgroundColor: "#fff",
    minHeight: 500, // กันไม่ให้สั้นเกินไป
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  badge: {
    backgroundColor: "#DBEAFE", // สีฟ้าอ่อน
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    color: "#1E40AF",
    fontSize: 12,
    fontFamily: "KanitMedium",
  },
  dateText: {
    color: "#6B7280",
    fontSize: 13,
    fontFamily: "KanitRegular",
  },
  title: {
    fontSize: 22,
    fontFamily: "KanitSemiBold",
    color: "#111827",
    marginBottom: 16,
    lineHeight: 30,
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    fontFamily: "KanitRegular",
    color: "#374151",
    lineHeight: 26, // ระยะห่างบรรทัดให้อ่านง่าย
  },
  authorContainer: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    flexDirection: "row",
    alignItems: "center",
  },
  authorLabel: {
    fontFamily: "KanitRegular",
    fontSize: 14,
    color: "#9CA3AF",
    marginRight: 8,
  },
  authorName: {
    fontFamily: "KanitMedium",
    fontSize: 14,
    color: "#4B5563",
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: 4,
    marginRight: 4,
  },
});
