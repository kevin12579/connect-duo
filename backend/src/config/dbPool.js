require('dotenv').config(); // .env 파일을 읽어옵니다.
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    waitForConnections: true,

    ssl: {
        rejectUnauthorized: false // 클라우드 DB 인증서를 신뢰하도록 설정
    },
    // --- SSL 설정 끝 ---
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

module.exports = pool;
