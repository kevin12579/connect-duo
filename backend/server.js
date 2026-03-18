// server.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');

const signupRouter = require('./src/routes/signupRouter');
const loginRouter = require('./src/routes/loginRouter');
const profileRouter = require('./src/routes/profileRouter');
const aiRouter = require('./src/routes/aiRouter');
const chatRouter = require('./src/routes/chatRouter');
const creditRouter = require('./src/routes/creditRouter'); // ★ 추가
const socketHandler = require('./src/services/chatSocket');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const address = process.env.ADDRESS || 'http://localhost:7777';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: FRONTEND_URL,
        credentials: true,
    },
});

app.set('io', io);

app.use(
    cors({
        origin: FRONTEND_URL,
        credentials: true,
    }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(morgan('dev'));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

app.use('/api/chat', chatRouter);
app.use('/api/accounts/signup', signupRouter);
app.use('/api/accounts', loginRouter);
app.use('/api/profile', profileRouter);
app.use('/api/ai', aiRouter);
app.use('/api/credit', creditRouter); // ★ 추가

socketHandler(io);

server.listen(address, () => {
    console.log(`Server running at ${address}`);
});
