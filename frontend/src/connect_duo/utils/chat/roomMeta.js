// src/connect_duo/utils/chat/roomMeta.js
import { ROOMS_KEY, CHAT_META_UPDATED_EVENT, safeParse } from './storage';

export function emitMetaUpdate() {
    window.dispatchEvent(new Event(CHAT_META_UPDATED_EVENT));
}

export function readRoomMetaList() {
    const rooms = safeParse(localStorage.getItem(ROOMS_KEY), []);
    return Array.isArray(rooms) ? rooms : [];
}

export function upsertRoomMeta(rid, patch) {
    if (!rid) return;

    const list = readRoomMetaList();
    const idx = list.findIndex((r) => String(r?.id) === String(rid));

    const base =
        idx >= 0
            ? list[idx]
            : {
                  id: String(rid),
                  title: '세무쳇',
                  createdAt: Date.now(),
                  unreadCount: 0,
              };

    const nextRoom = { ...base, ...patch, updatedAt: Date.now() };
    const next = idx >= 0 ? list.map((r, i) => (i === idx ? nextRoom : r)) : [nextRoom, ...list];

    localStorage.setItem(ROOMS_KEY, JSON.stringify(next));
    emitMetaUpdate();
}
