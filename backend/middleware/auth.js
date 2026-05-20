const jwt = require('jsonwebtoken');
const { findUserById } = require('../models/user');

const JWT_SECRET = process.env.JWT_SECRET || 'love-strategist-jwt-secret-key-2024-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function generateToken(user) {
  return jwt.sign(
    {
      userId: user.id,
      email: user.email,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未授权，请先登录' });
  }
  
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
  
  try {
    const user = await findUserById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }
    
    req.user = user;
    req.token = decoded;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: '服务器错误' });
  }
}

async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  
  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  
  if (!decoded) {
    req.user = null;
    return next();
  }
  
  try {
    const user = await findUserById(decoded.userId);
    req.user = user || null;
    next();
  } catch (err) {
    req.user = null;
    next();
  }
}

module.exports = {
  generateToken,
  verifyToken,
  authMiddleware,
  optionalAuth
};
