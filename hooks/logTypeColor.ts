export function logTypeColor(type: string) {
    return type === "join"
        ? "#4fb146ff"
        : type === "leave"
            ? "#da1f1fff"
            : null;
}

export function iconType(type: string) {
    return type === "join"
        ? "arrow-forward"
        : type === "leave"
            ? "arrow-back"
            : null;
}