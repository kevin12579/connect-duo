const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: '127.0.0.1',
    port: 3306,
    user: 'root',
    password: '5972',
    database: 'connect_duo_local',

    waitForConnections: true,
    connectionLimit: 10,

    // ✅ 한글 깨짐 방지 핵심
    charset: 'utf8mb4',
});

module.exports = pool;
