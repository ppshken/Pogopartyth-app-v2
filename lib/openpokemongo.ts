// lib/openPokemonGo.ts
import { Linking, Platform, Alert } from "react-native";

const POKEMON_GO_SCHEME = "pokemongo://";
const ANDROID_PACKAGE = "com.nianticlabs.pokemongo";
const PLAY_STORE_URL = "market://details?id=com.nianticlabs.pokemongo";
const PLAY_STORE_WEB_URL = "https://play.google.com/store/apps/details?id=com.nianticlabs.pokemongo";

// ใช้ itms-apps:// เพื่อเด้งเข้า App Store โดยตรง (ในแอป)
const APP_STORE_URL = "itms-apps://apps.apple.com/app/id1094591345";

export async function openPokemonGo() {
  try {
    if (Platform.OS === "ios") {
      // iOS: ลองเปิดตรง ๆ (หลีกเลี่ยง canOpenURL เพราะ Expo Go จะ false)
      try {
        await Linking.openURL(POKEMON_GO_SCHEME);
        return;
      } catch {
        // ไม่ติดตั้ง → เปิด App Store
        await Linking.openURL(APP_STORE_URL);
        return;
      }
    } else {
      // ANDROID
      const supported = await Linking.canOpenURL(POKEMON_GO_SCHEME);
      if (supported) {
        await Linking.openURL(POKEMON_GO_SCHEME);
        return;
      }

      // แผนสำรอง: intent
      const intent = `intent://#Intent;scheme=pokemongo;package=${ANDROID_PACKAGE};end`;
      try {
        await Linking.openURL(intent);
        return;
      } catch {
        // สุดท้าย เปิด Play Store
        try {
          await Linking.openURL(PLAY_STORE_URL);
        } catch {
          await Linking.openURL(PLAY_STORE_WEB_URL);
        }
        return;
      }
    }
  } catch (e) {
    Alert.alert(
      "เปิด Pokémon GO ไม่ได้",
      "ตรวจสอบว่าได้ติดตั้งแอพไว้แล้ว หรือเปิดจากไอคอนเกมโดยตรง"
    );
  }
}
