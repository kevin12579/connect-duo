const ROOMS_KEY = 'chat_rooms';
const CHAT_META_UPDATED_EVENT = 'chat_meta_updated';

function safeParse(raw, fallback) {
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

export function ensureRoomExists(rid) {
    const rooms = getRooms();
    if (rooms.some((r) => r?.id === rid)) return;

    const next = [
        ...rooms,
        {
            id: rid,
            title: '세무쳇',
            createdAt: Date.now(),
        },
    ];
    saveRooms(next);
}

export { ROOMS_KEY, CHAT_META_UPDATED_EVENT, safeParse };
