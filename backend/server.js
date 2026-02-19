// server.js
const express = require('express');
require('dotenv').config();
//npm i dotenv morgan
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');

//라우터 가져오기
const signupRouter = require('./src/routes/signupRouter');
const loginRouter = require('./src/routes/loginRouter');
const profileRouter = require('./src/routes/profileRouter');

const port = process.env.PORT || 7777;
console.log('port: ', port);

const app = express();
//미들웨어 설정
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'));
app.use(cors()); //react와 통신시 필요함

//라우터와 연결
app.use('/api/accounts/signup', signupRouter);
app.use('/api/accounts', loginRouter);
app.use('/api/profile', profileRouter);

app.listen(port, () => {
    console.log(`http://localhost:${port}`);
});
