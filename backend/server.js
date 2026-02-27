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
const socketHandler = require('./src/services/chatSocket');

const port = process.env.PORT || 7777;
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: 'http://localhost:3000',
        credentials: true,
    },
});

app.set('io', io);

app.use(
    cors({
        origin: 'http://localhost:3000',
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

socketHandler(io);

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
