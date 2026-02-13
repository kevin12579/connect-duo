const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: '127.0.0.1',
    port: '3306',
    user: 'root', //root
    password: 'connect6343@', //1234
    database: 'connect_duo',
    connectionLimit: 10,
    waitForConnections: true,
});
module.exports = pool;
