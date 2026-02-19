const multer = require('multer');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const base = path.basename(file.originalname, ext).replace(/\s+/g, '_');
        cb(null, `${Date.now()}_${base}${ext}`);
    },
});

// txt, 이미지 정도만 허용
const fileFilter = (req, file, cb) => {
    const ok =
        file.mimetype.startsWith('image/') ||
        file.mimetype === 'text/plain' ||
        file.originalname.toLowerCase().endsWith('.txt');
    cb(ok ? null : new Error('허용되지 않은 파일 타입'), ok);
};

const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

module.exports = { upload, UPLOAD_DIR };
