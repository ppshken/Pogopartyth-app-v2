// app/premium_plan.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function PremiumPlanScreen() {
  const router = useRouter();

  const handleBuyPremium = () => {
    // TODO: เปลี่ยน path ตามหน้า checkout จริงของคุณ
    // เช่น router.push("/premium/checkout");
    console.log("Go to premium checkout");
  };

  const handlePrivacy = () => {
    // TODO: เปลี่ยน path หรือ external link
    // router.push("/privacy");
    console.log("Go to privacy");
  };

  const handleTerms = () => {
    // TODO: เปลี่ยน path หรือ external link
    // router.push("/terms");
    console.log("Go to terms");
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <Text style={styles.title}>Pogopartyth Premium</Text>
      <Text style={styles.subtitle}>
        ปลดล็อคความสะดวกในการจัดห้องและเข้าร่วมบอส ให้การตีบอสของคุณลื่นกว่าเดิม
      </Text>

      {/* Free Plan */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.planName}>Free</Text>
          <Text style={styles.planBadge}>ปัจจุบัน</Text>
        </View>

        <Text style={styles.planPrice}>ฟรี</Text>
        <Text style={styles.planDesc}>สำหรับผู้เริ่มต้นใช้งาน Pogopartyth</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>สร้างห้อง</Text>
          <View style={styles.row}>
            <Dot />
            <Text style={styles.text}>
              สร้างห้องได้เฉพาะบอสปกติ{" "}
              <Text style={styles.textDim}>
                (สร้างบอส Special / Event ไม่ได้)
              </Text>
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>เข้าร่วมห้อง</Text>

          <View style={styles.row}>
            <Dot />
            <Text style={styles.text}>
              บอสปกติ:{" "}
              <Text style={styles.textHighlight}>
                เข้าร่วมได้ทันที ไม่ต้องรอคูลดาวน์
              </Text>
            </Text>
          </View>

          <View style={styles.row}>
            <Dot />
            <Text style={styles.text}>
              บอสอีเวนต์:{" "}
              <Text style={styles.textDim}>
                เข้าร่วมได้หลังจากนับถอยหลัง 10 วินาที
              </Text>
            </Text>
          </View>

          <View style={styles.row}>
            <Dot />
            <Text style={styles.text}>
              บอส Special / G-Max:{" "}
              <Text style={styles.textDim}>
                เข้าร่วมได้หลังจากนับถอยหลัง 10 วินาที
              </Text>
            </Text>
          </View>
        </View>
      </View>

      {/* Premium Plan */}
      <View style={[styles.card, styles.cardPremium]}>
        <View style={styles.cardHeader}>
          <View style={styles.plan}>
            <Text style={[styles.planName, styles.planNamePremium]}>
              Premium
            </Text>
            <Text style={styles.buyButtonTextPrice}>99 บาท / เดือน</Text>
          </View>
          <View style={styles.recommendBadge}>
            <Ionicons name="star" size={14} color="#f59e0b"/>
            <Text style={styles.recommendText}>แนะนำ</Text>
          </View>
        </View>

        <Text style={[styles.planPrice, styles.planPricePremium]}>
          สมัครเพื่อปลดล็อคทั้งหมด
        </Text>
        <Text style={styles.planDesc}>
          สำหรับเทรนเนอร์ที่จริงจังกับการจัดห้อง ตีบอส และสร้างคอมมูนิตี้
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>สร้างห้อง</Text>

          <View style={styles.row}>
            <Dot premium />
            <Text style={styles.text}>
              สร้างห้องได้{" "}
              <Text style={styles.textHighlight}>ทุกประเภทบอส</Text> (ปกติ /
              Event / Special / G-Max)
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>เข้าร่วมห้อง</Text>

          <View style={styles.row}>
            <Dot premium />
            <Text style={styles.text}>
              เข้าร่วมห้อง{" "}
              <Text style={styles.textHighlight}>ได้ทันทีทุกบอส</Text>{" "}
              ไม่ต้องรอคูลดาวน์
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ตัวเลือกพิเศษของห้อง</Text>

          <View style={styles.row}>
            <Dot premium />
            <Text style={styles.text}>
              <Text style={styles.textHighlight}>ล็อคห้องด้วยรหัสผ่าน</Text>{" "}
              เลือกให้เข้าร่วมได้เฉพาะคนที่คุณเชิญ
            </Text>
          </View>

          <View style={styles.row}>
            <Dot premium />
            <Text style={styles.text}>
              ตั้งค่า{" "}
              <Text style={styles.textHighlight}>ห้องเฉพาะผู้ใช้ Premium</Text>
            </Text>
          </View>

          <View style={styles.row}>
            <Dot premium />
            <Text style={styles.text}>
              กำหนด <Text style={styles.textHighlight}>เลเวลขั้นต่ำ</Text>{" "}
              ก่อนเข้าร่วม เพื่อให้เหมาะกับระดับห้อง
            </Text>
          </View>

          <View style={styles.row}>
            <Dot premium />
            <Text style={styles.text}>
              <Text style={styles.textHighlight}>ดันห้องให้อยู่ด้านบน</Text>{" "}
              มองเห็นง่ายในหน้ารายการห้อง
            </Text>
          </View>
        </View>

        {/* Buy button */}
        <TouchableOpacity style={styles.buyButton} onPress={handleBuyPremium}>
          <Text style={styles.buyButtonText}>สมัคร Premium</Text>
        </TouchableOpacity>
      </View>

      {/* Footer links */}
      <View style={styles.footerLinks}>
        <TouchableOpacity onPress={handlePrivacy}>
          <Text style={styles.footerLinkText}>Privacy Policy</Text>
        </TouchableOpacity>

        <View style={styles.footerDot} />

        <TouchableOpacity onPress={handleTerms}>
          <Text style={styles.footerLinkText}>Terms of Service</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Dot({ premium }: { premium?: boolean }) {
  return (
    <View
      style={[
        styles.dot,
        premium && { backgroundColor: "#f59e0b" }, // สีทองๆ ให้ดู premium หน่อย
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  title: {
    fontSize: 24,
    fontFamily: "KanitSemiBold",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 16,
    fontFamily: "KanitMedium",
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardPremium: {
    borderColor: "#f59e0b",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  plan: {
    flexDirection: "column",
    alignItems: "center",
  },
  planName: {
    fontSize: 20,
    fontFamily: "KanitSemiBold",
  },
  planNamePremium: {
    color: "#d97706",
  },
  planBadge: {
    fontSize: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#e5e7eb",
    color: "#4b5563",
    fontFamily: "KanitSemiBold",
  },
  recommendBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "#fef3c7",
    gap: 4,
  },
  recommendText: {
    fontSize: 12,
    fontFamily: "KanitSemiBold",
    color: "#92400e",
  },
  planPrice: {
    fontSize: 16,
    fontFamily: "KanitSemiBold",
    marginBottom: 4,
  },
  planPricePremium: {
    color: "#b45309",
  },
  planDesc: {
    fontSize: 13,
    color: "#6b7280",
    marginBottom: 8,
    fontFamily: "KanitMedium",
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontFamily: "KanitSemiBold",
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 999,
    marginTop: 7,
    marginRight: 6,
    backgroundColor: "#9ca3af",
  },
  text: {
    flex: 1,
    fontSize: 13,
    color: "#111827",
    fontFamily: "KanitMedium",
  },
  textDim: {
    color: "#6b7280",
    fontFamily: "KanitMedium",
  },
  textHighlight: {
    fontFamily: "KanitSemiBold",
  },
  buyButton: {
    marginTop: 16,
    backgroundColor: "#f59e0b",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  buyButtonText: {
    color: "#111827",
    fontFamily: "KanitSemiBold",
    fontSize: 16,
  },
  buyButtonTextPrice: {
    color: "#555555ff",
    fontFamily: "KanitSemiBold",
    fontSize: 14,
  },
  footerLinks: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  footerLinkText: {
    fontSize: 12,
    color: "#6b7280",
    textDecorationLine: "underline",
  },
  footerDot: {
    width: 4,
    height: 4,
    borderRadius: 999,
    backgroundColor: "#d1d5db",
  },
});
