import { safeParse } from './storage';
import { formatDayLabel } from './date';

function safeString(s, fallback = '') {
    return typeof s === 'string' ? s : fallback;
}

export function getUnreadCount(roomId) {
    try {
        const history = safeParse(localStorage.getItem(`chat_history_${roomId}`), []);
        const lastReadRaw = localStorage.getItem(`chat_lastRead_${roomId}`);
        const lastRead = lastReadRaw ? new Date(lastReadRaw).getTime() : 0;

        const list = Array.isArray(history) ? history : [];

        let count = 0;
        for (const m of list) {
            if (!m) continue;

            // ✅ time 보정: time이 없으면 createdAt/created_at도 허용
            const tRaw = m.time ?? m.createdAt ?? m.created_at;
            if (!tRaw) continue;
            const t = typeof tRaw === 'number' ? tRaw : new Date(tRaw).getTime();
            if (!t || Number.isNaN(t)) continue;

            // ✅ system 제외
            const isSystem = m.type === 'system' || m.from === 'system';
            if (isSystem) continue;

            // ✅ incoming 범위 확장 (너 프로젝트에서 실제 from 값들 대응)
            const from = String(m.from || '');
            const incoming = from !== 'me'; // 🔥 핵심: 내 메시지만 제외하고 나머지는 수신으로 친다

            if (!incoming) continue;

            if (t > lastRead) count += 1;
        }

        return count;
    } catch {
        return 0;
    }
}

export function getPreviewFromHistory(history) {
    if (!Array.isArray(history) || history.length === 0) return '대화를 시작해보세요 🙂';

    const reversed = [...history].reverse();

    // ✅ 우선순위: 상담사(agent/bot) 마지막 → 내 마지막 → 기타
    const lastAgent = reversed.find(
        (m) =>
            m &&
            (m.from === 'agent' || m.from === 'bot') &&
            m.type !== 'system' &&
            typeof m.text === 'string' &&
            m.text.trim(),
    );
    if (lastAgent?.text) return lastAgent.text;

    const lastMe = reversed.find((m) => m && m.from === 'me' && m.type !== 'system');
    if (lastMe?.text) return lastMe.text;
    if (lastMe?.fileName) return `[파일] ${lastMe.fileName}`;

    const lastAny = reversed.find((m) => m && m.type !== 'system');
    return lastAny?.text || '대화를 시작해보세요 🙂';
}

export function getRoomCard(room) {
    const rid = room.id;

    const meta = safeParse(localStorage.getItem(`chat_meta_${rid}`), null);
    const history = safeParse(localStorage.getItem(`chat_history_${rid}`), []);

    const updatedAt =
        (meta && typeof meta.updatedAt === 'number' ? meta.updatedAt : null) ||
        (() => {
            const last = Array.isArray(history) && history.length ? history[history.length - 1] : null;
            return last?.time ? new Date(last.time).getTime() : room.createdAt || 0;
        })();

    const title = '세무쳇';
    const preview = safeString(meta?.preview, '') || getPreviewFromHistory(history);
    const unread = getUnreadCount(rid);

    return {
        id: rid,
        title,
        preview,
        updatedAt,
        dayLabel: formatDayLabel(updatedAt),
        unread,
    };
}
