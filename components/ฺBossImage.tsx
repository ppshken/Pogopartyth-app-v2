import { View, Image } from "react-native";
import React from "react";

type Props = {
  pokemon_image?: string;
  boss_type?: "mega" | "shadow" | "dynamax" | "gigantamax" | string;
  width: number;
  height: number;
  borderRadius: number;
  iconwidth: number;
  iconheight: number;
};

const FALLBACK =
  "https://static.wikia.nocookie.net/pokemongo/images/5/55/Emblem_Raid.png/revision/latest?cb=20170907130239";

// ✅ map boss_type -> icon ที่เป็น require จริง ๆ
const BOSS_ICON_MAP: Record<string, any> = {
  mega: require("assets/boss_type_image/mega-icon.png"),
  shadow: require("assets/boss_type_image/shadow-icon.png"), // ถ้ามีไฟล์นี้
  dynamax: require("assets/boss_type_image/gmax-icon.png"),
  gigantamax: require("assets/boss_type_image/gmax-icon.png"),
};

export function BossImage({
  pokemon_image,
  boss_type,
  width,
  height,
  borderRadius,
  iconwidth,
  iconheight,
}: Props) {
  // icon ของ type นั้น ๆ ถ้าไม่แมตช์จะเป็น undefined
  const typeIconSource = boss_type ? BOSS_ICON_MAP[boss_type] : undefined;

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      {/* รูปโปเกมอนหลัก */}
      <Image
        source={{ uri: pokemon_image || FALLBACK }}
        style={{
          width,
          height,
          borderRadius,
          backgroundColor: "#F3F4F6",
        }}
        resizeMode="cover"
      />

      {/* icon ประเภทบอส มุมล่างขวา (โชว์เฉพาะถ้ามี source) */}
      {typeIconSource && (
        <Image
          source={typeIconSource}
          style={{
            position: "absolute",
            width: iconwidth,
            height: iconheight,
            bottom: 0,
            right: 0,
          }}
          resizeMode="contain"
        />
      )}
    </View>
  );
}
