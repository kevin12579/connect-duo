// indexRouter.js
const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    const str = `
        <div>
            <a href="/api/posts">POSTS 관리</a>|
            <a href="/api/users">USER 관리</a>
        </div>
    `;
    res.send(str);
});
module.exports = router;
