// src/routes/uploadsRouter.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// 업로드 폴더(실제 파일이 저장되는 곳)
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

router.get('/', (req, res) => {
    try {
        if (!fs.existsSync(UPLOAD_DIR)) {
            res.status(200).send('<h3>uploads 폴더가 없습니다.</h3>');
            return;
        }

        const files = fs
            .readdirSync(UPLOAD_DIR)
            .filter((f) => !f.startsWith('.'))
            .sort((a, b) => b.localeCompare(a));

        const items = files
            .map((f) => {
                const isTxt = f.toLowerCase().endsWith('.txt');
                const openUrl = isTxt ? `/uploads-ui/view/${encodeURIComponent(f)}` : `/uploads/${encodeURIComponent(f)}`;
                const downloadUrl = `/uploads/${encodeURIComponent(f)}`;

                return `
<li style="margin:8px 0;">
  <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
    <div style="min-width:280px; font-weight:700;">${escapeHtml(f)}</div>
    <a href="${openUrl}" target="_blank" rel="noreferrer">열기</a>
    <a href="${downloadUrl}" download>다운로드</a>
  </div>
</li>`;
            })
            .join('\n');

        res.type('html').send(`
<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Uploads</title>
</head>
<body style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Noto Sans KR,Arial; padding:16px;">
  <h2 style="margin:0 0 12px;">Uploads</h2>
  <div style="opacity:.7; margin-bottom:12px;">총 ${files.length}개</div>
  <ul style="padding-left:18px; margin:0;">${items || '<li>파일이 없습니다.</li>'}</ul>
</body>
</html>`);
    } catch (e) {
        console.error('[uploads-ui] error:', e);
        res.status(500).send('Server error');
    }
});

router.get('/view/:filename', (req, res) => {
    try {
        const filename = String(req.params.filename || '');
        if (!filename) return res.status(400).send('Bad request');

        // path traversal 방지
        const safeName = path.basename(filename);
        const full = path.join(UPLOAD_DIR, safeName);

        if (!fs.existsSync(full)) return res.status(404).send('Not found');

        // txt만 뷰어 제공
        if (!safeName.toLowerCase().endsWith('.txt')) {
            return res.redirect(`/uploads/${encodeURIComponent(safeName)}`);
        }

        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        fs.createReadStream(full).pipe(res);
    } catch (e) {
        console.error('[uploads-ui/view] error:', e);
        res.status(500).send('Server error');
    }
});

function escapeHtml(s) {
    return String(s)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

module.exports = router;