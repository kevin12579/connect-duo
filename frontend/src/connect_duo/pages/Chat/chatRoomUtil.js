export const LAST_READ_MS_KEY = (rid) => `chat_last_read_at_${rid}`;

const DRAFT_KEY = 'cd_chat_drafts_v1';
const DRAFT_EVENT = 'cd_draft_updated';

export function getDraft(roomId) {
    if (typeof window === 'undefined') return '';
    try {
        const map = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
        return String(map?.[String(roomId)] || '');
    } catch {
        return '';
    }
}

export function saveDraft(roomId, text) {
    if (typeof window === 'undefined') return;
    try {
        const map = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
        const rid = String(roomId);
        const v = String(text || '').trim();

        if (v) map[rid] = v;
        else delete map[rid];

        localStorage.setItem(DRAFT_KEY, JSON.stringify(map));
        window.dispatchEvent(new Event(DRAFT_EVENT));
    } catch (error) {
        console.error('Failed to save draft:', error);
    }
}

export function mapRowToUiMessage(row, myId, absolutizeFileUrl) {
    if (!row) return null;

    const senderId = row.sender_id ?? row.senderId ?? row.user_id ?? row.userId;
    const isMe = String(senderId) === String(myId);

    const rawUrl = row.file_url ?? row.fileUrl ?? row.url ?? row.downloadUrl ?? null;
    const absUrl = rawUrl ? (absolutizeFileUrl ? absolutizeFileUrl(rawUrl) : rawUrl) : null;

    let fileName = row.file_name ?? row.fileName ?? row.originalName ?? row.name ?? '';
    if (!fileName && absUrl) {
        const parts = String(absUrl).split('/');
        fileName = parts[parts.length - 1] || '';
        try {
            fileName = decodeURIComponent(fileName);
        } catch {}
    }

    // type normalize
    let type = String(row.type ?? row.message_type ?? row.messageType ?? 'TEXT').toUpperCase();
    if (!['TEXT', 'FILE', 'IMAGE', 'SYSTEM'].includes(type)) type = 'TEXT';

    // url이 있는데 TEXT로 오면 확장자로 보정
    if (absUrl && type === 'TEXT') {
        const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(String(fileName));
        type = isImg ? 'IMAGE' : 'FILE';
    }

    const isRead =
        row?.is_read === true ||
        row?.is_read === 1 ||
        row?.isRead === true ||
        row?.isRead === 1 ||
        row?.read === true ||
        row?.read === 1;

    return {
        id: row.id ?? row.message_id ?? row.messageId ?? `unknown-${Math.random().toString(36).substring(2, 11)}`,
        from: isMe ? 'me' : 'agent',
        type,
        text: row.content ?? row.text ?? row.message ?? '',
        fileUrl: absUrl,
        fileName,
        fileMime: row.file_mime ?? row.fileMime ?? row.mime ?? null,
        fileSize: row.fileSize ?? row.file_size ?? row.size ?? row.filesize ?? null,
        time: row.created_at ?? row.createdAt ?? row.createdAtUtc ?? row.time ?? new Date().toISOString(),
        isRead,
    };
}

export function formatBytes(bytes) {
    const n = Number(bytes);
    if (!Number.isFinite(n) || n <= 0) return '';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let v = n;
    let i = 0;
    while (v >= 1024 && i < units.length - 1) {
        v /= 1024;
        i += 1;
    }
    const fixed = i === 0 ? 0 : 2;
    return `${v.toFixed(fixed)}${units[i]}`;
}

export function formatExpireDate(baseTime) {
    if (!baseTime) return '';
    const base = new Date(baseTime);
    if (Number.isNaN(base.getTime())) return '';

    const expire = new Date(base);
    expire.setDate(expire.getDate() + 7);

    const yyyy = expire.getFullYear();
    const mm = String(expire.getMonth() + 1).padStart(2, '0');
    const dd = String(expire.getDate()).padStart(2, '0');

    return `${yyyy}.${mm}.${dd}`;
}

export function isTxtLike(m) {
    if (!m) return false;
    const name = String(m.fileName || '').toLowerCase();
    const mime = String(m.fileMime || '').toLowerCase();
    return name.endsWith('.txt') || mime === 'text/plain';
}

export function displayFileTitle(m) {
    const raw = m?.fileName || '파일';
    return isTxtLike(m) ? raw.replace(/\.txt$/i, '') : raw;
}

/**
 * ✅ TXT 뷰어 URL 생성
 * - fileUrl의 마지막 파일명을 가져와 decode->encode(1회)로 정규화
 * - origin 기준 /uploads/{filename} 로 붙임
 */
export function getTxtViewerUrl(fileUrl) {
    const u = String(fileUrl || '');
    if (!u) return '';

    const getFilename = (pathnameOrUrl) => {
        const s = String(pathnameOrUrl || '');
        const idx = s.lastIndexOf('/');
        const name = idx >= 0 ? s.slice(idx + 1) : s;
        let decoded = name;
        try {
            decoded = decodeURIComponent(name);
        } catch {}
        return encodeURIComponent(decoded);
    };

    // 브라우저면 origin 기준으로 안전 조립
    if (typeof window !== 'undefined') {
        try {
            const url = new URL(u, window.location.origin);
            const filename = getFilename(url.pathname);
            return `${url.origin}/uploads/${filename}`;
        } catch {
            // 상대/깨진 url도 filename만 뽑아서 origin에 붙임
            const filename = getFilename(u);
            return `${window.location.origin}/uploads/${filename}`;
        }
    }

    // SSR/Node 환경: 그냥 /uploads/filename 형태
    const filename = getFilename(u);
    return `/uploads/${filename}`;
}

// ✅ 다운로드 파일명 안전 처리(슬래시/특수문자)
function safeDownloadName(name) {
    const raw = String(name || 'download');
    return raw.replace(/[\\/:*?"<>|]/g, '_');
}

// ✅ Content-Disposition에서 파일명 추출(있으면 우선)
function extractFilenameFromDisposition(disposition) {
    const d = String(disposition || '');
    if (!d) return '';
    // filename*=UTF-8''...
    const m1 = d.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    if (m1?.[1]) {
        try {
            return decodeURIComponent(m1[1]);
        } catch {
            return m1[1];
        }
    }
    // filename="..."
    const m2 = d.match(/filename\s*=\s*"([^"]+)"/i);
    if (m2?.[1]) return m2[1];
    // filename=...
    const m3 = d.match(/filename\s*=\s*([^;]+)/i);
    if (m3?.[1]) return m3[1].trim();
    return '';
}

export async function downloadFile(url, fileName) {
    const res = await fetch(url, { credentials: 'include' });

    if (res.status === 410) {
        const err = new Error('EXPIRED');
        err.code = 410;
        throw err;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob = await res.blob();

    // ✅ 서버가 파일명을 내려주면 그걸 우선
    const dispo = res.headers.get('content-disposition');
    const fromHeader = extractFilenameFromDisposition(dispo);
    const finalName = safeDownloadName(fromHeader || fileName || 'download');

    const a = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);

    a.href = objectUrl;
    a.download = finalName;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
}

export function escapeRegExp(s) {
    return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function extractMessagesSafely(res, extractMessagesFromAxiosResponse) {
    if (typeof extractMessagesFromAxiosResponse === 'function') {
        const x = extractMessagesFromAxiosResponse(res);
        if (Array.isArray(x)) return x;
    }
    const data = res?.data?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.messages)) return data.messages;
    if (Array.isArray(res?.data?.messages)) return res.data.messages;
    return [];
}

export function getMyIdFallback1() {
    if (typeof window === 'undefined') return 1;
    try {
        const userBackup = JSON.parse(localStorage.getItem('userBackup') || 'null');
        if (userBackup && userBackup.id) return userBackup.id;

        const user =
            JSON.parse(localStorage.getItem('auth') || '{}').user ||
            JSON.parse(localStorage.getItem('user') || '{}') ||
            JSON.parse(localStorage.getItem('loginUser') || '{}');

        return user?.id || localStorage.getItem('userId') || 1;
    } catch (e) {
        console.error('ID 추출 중 오류 발생:', e);
        return 1;
    }
}