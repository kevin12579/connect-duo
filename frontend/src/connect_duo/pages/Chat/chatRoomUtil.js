export const LAST_READ_MS_KEY = (rid) => `chat_last_read_at_${rid}`;

export function getDraft(roomId) {
    if (typeof window === 'undefined') return '';
    try {
        const map = JSON.parse(localStorage.getItem('cd_chat_drafts_v1') || '{}');
        return String(map?.[String(roomId)] || '');
    } catch {
        return '';
    }
}

export function saveDraft(roomId, text) {
    if (typeof window === 'undefined') return;
    try {
        const key = 'cd_chat_drafts_v1';
        const map = JSON.parse(localStorage.getItem(key) || '{}');
        const rid = String(roomId);
        const v = String(text || '').trim();

        if (v) {
            map[rid] = v;
        } else {
            delete map[rid];
        }

        localStorage.setItem(key, JSON.stringify(map));
        window.dispatchEvent(new Event('cd_draft_updated'));
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

    // ✅ 파일명 추출 로직 강화: row에 이름이 없으면 URL에서 추출
    let fileName = row.file_name ?? row.fileName ?? row.originalName ?? row.name ?? '';
    if (!fileName && absUrl) {
        const parts = absUrl.split('/');
        fileName = parts[parts.length - 1]; // URL의 마지막 부분(파일명)을 가져옴
    }

    // ✅ 타입 보정 로직: fileUrl이 있으면 TEXT가 아니라 FILE(또는 IMAGE)로 취급
    let type = (row.type ?? row.message_type ?? row.messageType ?? 'TEXT').toUpperCase();
    if (absUrl && type === 'TEXT') {
        // 이미지 확장자인지 체크
        const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
        type = isImg ? 'IMAGE' : 'FILE';
    }

    return {
        id: row.id ?? row.message_id ?? row.messageId ?? `unknown-${Math.random().toString(36).substring(2, 11)}`,
        from: isMe ? 'me' : 'agent',
        type: type, // 수정된 타입 적용
        text: row.content ?? row.text ?? row.message ?? '',
        fileUrl: absUrl,
        fileName: fileName, // 추출된 파일명 적용
        fileMime: row.file_mime ?? row.fileMime ?? row.mime ?? null,
        fileSize: row.fileSize ?? row.file_size ?? row.size ?? row.filesize ?? null,
        time: row.created_at ?? row.createdAt ?? row.createdAtUtc ?? row.time ?? new Date().toISOString(),
        isRead: row?.is_read === true || row?.is_read === 1,
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

export function getTxtViewerUrl(fileUrl) {
    const u = String(fileUrl || '');

    const build = (origin, filenameMaybeEncoded) => {
        let decoded = filenameMaybeEncoded;
        try {
            decoded = decodeURIComponent(String(filenameMaybeEncoded));
        } catch {}
        const onceEncoded = encodeURIComponent(decoded);

        return `${origin}/uploads/${onceEncoded}`;
    };

    if (typeof window === 'undefined') return build('', u);

    try {
        const url = new URL(u, window.location.origin);
        const pathname = url.pathname || '';
        const idx = pathname.lastIndexOf('/');
        const filename = idx >= 0 ? pathname.slice(idx + 1) : pathname;
        return build(url.origin, filename);
    } catch {
        const idx = u.lastIndexOf('/');
        const filename = idx >= 0 ? u.slice(idx + 1) : u;
        // catch 블록에서도 경로 수정
        return build('', filename).replace(/^\/?uploads-ui\/view/, '/uploads');
    }
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
    const a = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);

    a.href = objectUrl;
    a.download = fileName || 'download';
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a); // 메모리 누수 방지를 위한 DOM 정리
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
        if (userBackup && userBackup.id) {
            return userBackup.id;
        }

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
