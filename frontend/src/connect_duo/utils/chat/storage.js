export const ROOMS_KEY = 'chat_rooms';
export const CHAT_META_UPDATED_EVENT = 'chat_meta_updated';

export function safeParse(raw, fallback) {
    try {
        const v = raw ? JSON.parse(raw) : fallback;
        return v ?? fallback;
    } catch {
        return fallback;
    }
}

export function getRooms() {
    const rooms = safeParse(localStorage.getItem(ROOMS_KEY), []);
    return Array.isArray(rooms) ? rooms : [];
}

export function saveRooms(rooms) {
    localStorage.setItem(ROOMS_KEY, JSON.stringify(rooms));
    window.dispatchEvent(new Event(CHAT_META_UPDATED_EVENT));
}

export function ensureDefaultRoom() {
    const rooms = getRooms();
    if (rooms.length > 0) return rooms;

    const demo = { id: 'demo-room', title: '세무쳇', createdAt: Date.now() };
    saveRooms([demo]);
    return [demo];
}

export function makeRoomId() {
    return `room-${Date.now().toString(36)}`;
}
