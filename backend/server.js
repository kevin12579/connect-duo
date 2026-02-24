// server.js
const express = require('express');
require('dotenv').config();
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');

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

// ✅ public 정적 (필요하면 유지)
app.use(express.static(path.join(__dirname, 'public')));

// ✅ 업로드 파일 정적 서빙
app.use('/uploads', express.static(UPLOAD_DIR));

// ✅ "폴더 열기/텍스트 미리보기" UI
// - 이제 GET http://localhost:7777/uploads-ui  ✅
// - TXT: http://localhost:7777/uploads-ui/view/<filename> ✅
app.use('/uploads-ui', uploadsRouter);

// 라우터
app.use('/', indexRouter);
app.use('/api/accounts/signup', signupRouter);
app.use('/api/accounts', loginRouter);
app.use('/api/chat', chatRouter);
app.use('/api/health', healthRouter);

app.listen(port, () => {
    console.log(`http://localhost:${port}`);
});