const jwt = require('jsonwebtoken');
require('dotenv').config();

// [1] accessToken을 검증하는 미들웨어
exports.verifyAccessToken = (req, res, next) => {
    // console.log(req.headers);
    const token = req.headers['authorization']?.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            // 400보다는 401(Unauthorized)이 더 적절합니다.
            result: 'fail',
            message: '인증 토커이 필요합니다. 로그인 하세요',
        });
    }

    jwt.verify(token, process.env.ACCESS_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({
                result: 'fail',
                message: '유효하지 않거나 만료된 토큰입니다.',
            });
        }

        // ★ 중요: 페이로드 전체를 req.authUser에 담습니다.
        // 여기에는 { id, name, username, user_type }이 들어있게 됩니다.
        req.authUser = decoded;
        next();
    });
};

// [추가] 세무사 권한을 체크하는 미들웨어
// 세무사 전용 메뉴(상담 관리 등)에 접근할 때 사용하세요!
exports.verifyTaxAccountant = (req, res, next) => {
    if (!req.authUser) {
        return res.status(401).json({ message: '사용자 인증이 필요합니다' });
    }

    if (req.authUser.user_type !== 'TAX_ACCOUNTANT') {
        return res.status(403).json({ message: '세무사 회원만 이용 가능한 서비스입니다.' });
    }
    next();
};
