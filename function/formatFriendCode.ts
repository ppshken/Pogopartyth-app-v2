  // ฟอร์แมตรหัสเพิ่มเพื่อน (XXXX XXXX XXXX)
  export function formatFriendCode(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, 12);
    return digits.replace(/(\d{4})(?=\d)/g, "$1 ").trim(); // XXXX XXXX XXXX
  }