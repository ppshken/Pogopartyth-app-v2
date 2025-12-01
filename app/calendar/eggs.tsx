import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// --- Types ---
interface CombatPower {
  min: number;
  max: number;
}

interface EggPokemon {
  name: string;
  eggType: string;
  isAdventureSync: boolean;
  image: string;
  canBeShiny: boolean;
  combatPower: CombatPower;
  isRegional: boolean;
  isGiftExchange: boolean;
  rarity: number; // 1-5
}

// --- Config ---
const API_URL =
  "https://raw.githubusercontent.com/bigfoott/ScrapedDuck/data/eggs.json";
const { width } = Dimensions.get("window");
const COLUMN_COUNT = 3;
const ITEM_WIDTH = (width - 40 - 10 * (COLUMN_COUNT - 1)) / COLUMN_COUNT; // คำนวณขนาดการ์ด

// --- Helpers ---
const getEggColor = (type: string, isAdvSync: boolean) => {
  if (isAdvSync) return "#3B82F6"; // Adventure Sync (Blue)
  if (type.includes("2")) return "#10B981"; // 2km (Green)
  if (type.includes("5")) return "#F59E0B"; // 5km (Orange)
  if (type.includes("7")) return "#FCD34D"; // 7km (Yellow/Pinkish)
  if (type.includes("10")) return "#8B5CF6"; // 10km (Purple)
  if (type.includes("12")) return "#EF4444"; // 12km (Red)
  return "#6B7280";
};

const getEggLabel = (type: string) => {
  if (type === "Adventure Sync") return "Adv. Sync";
  return type;
};

export default function EggPoolScreen() {
  const [eggs, setEggs] = useState<EggPokemon[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("2 km");

  // รายชื่อ Tabs
  const tabs = ["2 km", "5 km", "7 km", "10 km", "12 km", "Adventure Sync"];

  // --- 1. Fetch Data ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(API_URL);
        const data = await response.json();
        setEggs(data);
      } catch (error) {
        console.error("Error fetching eggs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- 2. Filter Logic ---
  const filteredEggs = useMemo(() => {
    if (selectedTab === "Adventure Sync") {
      return eggs.filter((e) => e.isAdventureSync);
    }
    // กรองตามระยะทาง และต้องไม่ใช่ Adventure Sync (เพราะแยก Tab แล้ว)
    return eggs.filter((e) => e.eggType === selectedTab && !e.isAdventureSync);
  }, [selectedTab, eggs]);

  // --- 3. Render Components ---

  // Rarity Bar (1-5 dots)
  const renderRarity = (rarity: number) => {
    return (
      <View style={styles.rarityContainer}>
        {[1, 2, 3, 4, 5].map((level) => (
          <View
            key={level}
            style={[
              styles.rarityDot,
              {
                backgroundColor:
                  level <= rarity
                    ? getEggColor(selectedTab, selectedTab === "Adventure Sync")
                    : "#E5E7EB",
              },
            ]}
          />
        ))}
      </View>
    );
  };

  const renderItem = ({ item }: { item: EggPokemon }) => {
    return (
      <View style={styles.card}>
        {/* Shiny Badge */}
        {item.canBeShiny && (
          <View style={styles.shinyBadge}>
            <Ionicons name="sparkles" size={10} color="#F59E0B" />
          </View>
        )}

        {/* Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.image }}
            style={styles.pokemonImage}
            resizeMode="contain"
          />
        </View>

        {/* Info */}
        <Text style={styles.nameText} numberOfLines={1}>
          {item.name}
        </Text>

        {/* CP Range */}
        <Text style={styles.cpText}>
          CP {item.combatPower.min}-{item.combatPower.max}
        </Text>

        {/* Rarity */}
        {renderRarity(item.rarity)}

        {/* Region/Gift Indicators */}
        <View style={styles.tagRow}>
          {item.isRegional && (
            <Ionicons
              name="earth"
              size={12}
              color="#3B82F6"
              style={styles.iconTag}
            />
          )}
          {item.isGiftExchange && (
            <Ionicons
              name="gift-outline"
              size={12}
              color="#EC4899"
              style={styles.iconTag}
            />
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tabs (Distance Selector) */}
      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabContent}
        >
          {tabs.map((tab) => {
            const isActive = selectedTab === tab;
            const tabColor = getEggColor(tab, tab === "Adventure Sync");
            return (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tabButton,
                  isActive && {
                    backgroundColor: tabColor,
                    borderColor: tabColor,
                  },
                ]}
                onPress={() => setSelectedTab(tab)}
              >
                <Text
                  style={[
                    styles.tabText,
                    isActive && styles.tabTextActive,
                  ]}
                >
                  {getEggLabel(tab)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredEggs}
          renderItem={renderItem}
          keyExtractor={(item, index) => item.name + index}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>ไม่พบข้อมูลไข่ระยะนี้</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  centerLoading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  // Header
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "KanitSemiBold", // <--- Font
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#6B7280",
    marginTop: 2,
    fontFamily: "KanitSemiBold", // <--- Font
  },
  // Tabs
  tabContainer: {
    marginTop: 10,
    marginBottom: 10,
    height: 50,
  },
  tabContent: {
    paddingHorizontal: 16,
    alignItems: "center",
  },
  tabButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginRight: 8,
    minWidth: 70,
    alignItems: "center",
  },
  tabText: {
    fontSize: 14,
    fontFamily: "KanitSemiBold", // <--- Font
    color: "#4B5563",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  // List
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  columnWrapper: {
    justifyContent: "flex-start",
    gap: 10, 
  },
  // Card
  card: {
    width: ITEM_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 8,
    marginBottom: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  imageContainer: {
    width: "100%",
    height: 70,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  pokemonImage: {
    width: "90%",
    height: "90%",
  },
  shinyBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    zIndex: 10,
  },
  nameText: {
    fontSize: 12,
    fontFamily: "KanitSemiBold", // <--- Font
    color: "#374151",
    marginBottom: 2,
    textAlign: "center",
  },
  cpText: {
    fontSize: 10,
    color: "#9CA3AF",
    fontFamily: "KanitSemiBold", // <--- Font
    marginBottom: 6,
  },
  // Rarity
  rarityContainer: {
    flexDirection: "row",
    gap: 2,
    marginBottom: 6,
  },
  rarityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Tags (Regional / Gift)
  tagRow: {
    flexDirection: "row",
    gap: 4,
    height: 12,
  },
  iconTag: {
    opacity: 0.7,
  },
  // Empty
  emptyContainer: {
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: {
    color: "#9CA3AF",
    fontSize: 14,
    fontFamily: "KanitSemiBold", // <--- Font
  },
});