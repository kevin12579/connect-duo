const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith('Bearer ')) {
        return res.status(401).json({ message: '토큰 없음' });
    }

    try {
        const token = auth.split(' ')[1];
        req.user = jwt.verify(token, process.env.JWT_SECRET);
        return next();
    } catch {
        return res.status(401).json({ message: '토큰 무효' });
    }
}

module.exports = { requireAuth };
