const jwt = require('jsonwebtoken');

require('dotenv').config();

const authMiddleware = (req, res, next) => {
    const token = req.cookies.jwt;
    if (!token) {
        return res.render('auth')
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { 
            username: decoded.username, // Ensure this matches your JWT payload
         };
        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};

module.exports = authMiddleware;
