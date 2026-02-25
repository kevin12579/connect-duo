// server.js
const express = require('express');
require('dotenv').config();
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const fs = require('fs');

const { UPLOAD_DIR } = require('./src/middlewares/uploadMiddleware');
const uploadsRouter = require('./src/routes/uploadsRouter');

const indexRouter = require('./src/routes/indexRouter');
const signupRouter = require('./src/routes/signupRouter');
const loginRouter = require('./src/routes/loginRouter');
const chatRouter = require('./src/routes/chatRouter');
const healthRouter = require('./src/routes/healthRouter');

const port = process.env.PORT || 7777;
console.log('port: ', port);

const app = express();

app.locals.UPLOAD_DIR = UPLOAD_DIR;

const corsOptions = {
    origin: 'http://localhost:3000',
    credentials: true,
};

app.use(morgan('dev'));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

/* ======================================================
   ✅ 여기만 수정됨 — 다운로드 한글 깨짐 방지
====================================================== */
app.get('/uploads/:filename', (req, res) => {
    try {
        const raw = String(req.params.filename || '');
        if (!raw) return res.status(400).send('Bad request');

        // path traversal 방지
        const safeName = path.basename(raw);
        const fullPath = path.join(UPLOAD_DIR, safeName);

        if (!fs.existsSync(fullPath)) {
            return res.status(404).send('Not found');
        }

        // UTF-8 다운로드 헤더 강제 지정
        const encoded = encodeURIComponent(safeName);

        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encoded}`);

        return res.sendFile(fullPath);
    } catch (e) {
        console.error('[DOWNLOAD ERROR]', e);
        return res.status(500).send('Server error');
    }
});
/* ====================================================== */

app.use('/uploads-ui', uploadsRouter);

app.use('/', indexRouter);
app.use('/api/accounts/signup', signupRouter);
app.use('/api/accounts', loginRouter);
app.use('/api/chat', chatRouter);
app.use('/api/health', healthRouter);

app.listen(port, () => {
    console.log(`http://localhost:${port}`);
});
