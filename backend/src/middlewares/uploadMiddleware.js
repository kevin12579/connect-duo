// src/middlewares/uploadMiddleware.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function hangulScore(s) {
    return (String(s || '').match(/[가-힣]/g) || []).length;
}

/**
 * ✅ 한글 파일명 깨짐 방지(안전 버전)
 * - "무조건" latin1->utf8 하면 오히려 정상 파일명도 깨짐
 * - 변환 결과가 더 자연스러울 때만 채택
 */
function normalizeOriginalName(originalname) {
    const raw = String(originalname || '').trim();
    if (!raw) return 'file';

    // 1차: 그대로가 이미 한글이 많으면 정상일 확률 높음
    const rawHangul = hangulScore(raw);

    // 2차: latin1 -> utf8 시도
    let converted = raw;
    try {
        converted = Buffer.from(raw, 'latin1').toString('utf8');
    } catch {
        converted = raw;
    }

    // 3차: 변환이 더 좋아 보일 때만 채택
    const convHangul = hangulScore(converted);

    // 변환 결과에 �(replacement char)이 많으면 폐기
    const rawBad = (raw.match(/�/g) || []).length;
    const convBad = (converted.match(/�/g) || []).length;

    if (convBad < rawBad) return converted;
    if (convHangul > rawHangul) return converted;

    return raw;
}

/** ✅ 파일명 안전하게 만들기 */
function safeBaseName(name) {
    const ext = path.extname(name);
    const base = path.basename(name, ext);

    const cleaned = base
        .replace(/\s+/g, '_')
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\.+$/g, '')
        .slice(0, 60);

    return { base: cleaned || 'file', ext };
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        // ✅ 여기서도 교정(필요할 때만)
        const fixed = normalizeOriginalName(file.originalname);
        file.originalname = fixed;

        const { base, ext } = safeBaseName(fixed);
        cb(null, `${Date.now()}_${base}${ext}`);
    },
});

// txt, 이미지 정도만 허용
const fileFilter = (req, file, cb) => {
    const fixed = normalizeOriginalName(file.originalname);
    file.originalname = fixed;

    const lowerName = (fixed || '').toLowerCase();

    const ok =
        String(file.mimetype || '').startsWith('image/') ||
        file.mimetype === 'text/plain' ||
        lowerName.endsWith('.txt');

    cb(ok ? null : new Error('허용되지 않은 파일 타입'), ok);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = { upload, UPLOAD_DIR, normalizeOriginalName };
