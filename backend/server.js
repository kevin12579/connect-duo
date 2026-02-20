require('dotenv').config();
const express = require('express');
const cors = require('cors');
const pool = require('./src/db/pool');

const authRoutes = require('./src/routes/auth.routes');
const taxRoutes = require('./src/routes/tax.routes');

const app = express();

// JSON 먼저
app.use(express.json());

// CORS를 명시
app.use(
    cors({
        origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
    }),
);

// ❌ 이 줄이 현재 에러 원인이라 넣지 말아야 한다
// app.options('*', cors());

app.get('/health', (req, res) => res.json({ ok: true }));

app.get('/debug-db', async (req, res) => {
    try {
        const [[db]] = await pool.query('SELECT DATABASE() AS db');
        const [tables] = await pool.query('SHOW TABLES');
        res.json({ db: db.db, tables });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

app.use('/api/auth', authRoutes);
app.use('/api/tax', taxRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server running on ${PORT}`));
