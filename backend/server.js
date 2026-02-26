// server.js
const express = require('express');
require('dotenv').config();
//npm i dotenv morgan
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const multer = require('multer');

//라우터 가져오기
const signupRouter = require('./src/routes/signupRouter');
const loginRouter = require('./src/routes/loginRouter');
const profileRouter = require('./src/routes/profileRouter');
const aiRouter = require('./src/routes/aiRouter');
const chatRouter = require('./src/routes/chatRouter');

const port = process.env.PORT || 7777;
console.log('port: ', port);

const app = express();
app.use(
    cors({
        origin: 'http://localhost:3000', // 프론트엔드 주소
        credentials: true, // 쿠키/인증 정보를 포함한다면 필수
    }),
);
//미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'));
app.use(cors()); //react와 통신시 필요함

// ✅ 프론트에서 http://localhost:7777/uploads/파일명 으로 접근 가능하게 함
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));
//라우터와 연결
app.use('/api/chat', chatRouter);
app.use('/api/accounts/signup', signupRouter);
app.use('/api/accounts', loginRouter);
app.use('/api/profile', profileRouter);
app.use('/api/ai', aiRouter);
app.listen(port, () => {
    console.log(`http://localhost:${port}`);
});
