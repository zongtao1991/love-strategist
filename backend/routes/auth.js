const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { generateToken, authMiddleware, optionalAuth } = require('../middleware/auth');
const { createUser, findUserByEmail, validatePassword, updateLastLogin, findUserById, ROLES } = require('../models/user');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { email, password, nickname } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码不能为空' });
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: '密码至少需要6个字符' });
    }
    
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }
    
    const userId = await createUser(email, password, nickname, ROLES.USER);
    const user = await findUserById(userId);
    const token = generateToken(user);
    
    res.status(201).json({
      message: '注册成功',
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        createdAt: user.created_at
      }
    });
  } catch (err) {
    console.error('注册失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码不能为空' });
    }
    
    const user = await findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    
    const isValid = await validatePassword(user, password);
    if (!isValid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    
    await updateLastLogin(user.id);
    
    const token = generateToken(user);
    const updatedUser = await findUserById(user.id);
    
    res.json({
      message: '登录成功',
      token,
      user: {
        id: updatedUser.id,
        email: updatedUser.email,
        nickname: updatedUser.nickname,
        role: updatedUser.role,
        createdAt: updatedUser.created_at,
        lastLogin: updatedUser.last_login
      }
    });
  } catch (err) {
    console.error('登录失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    
    res.json({
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      role: user.role,
      createdAt: user.created_at,
      lastLogin: user.last_login
    });
  } catch (err) {
    console.error('获取用户信息失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/logout', authMiddleware, (req, res) => {
  res.json({ message: '已登出' });
});

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { nickname } = req.body;
    const { db, run } = require('../models');
    
    if (nickname) {
      await run('UPDATE users SET nickname = ? WHERE id = ?', [nickname, req.user.id]);
    }
    
    const user = await findUserById(req.user.id);
    
    res.json({
      message: '更新成功',
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role
      }
    });
  } catch (err) {
    console.error('更新用户信息失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/guest', async (req, res) => {
  try {
    const guestId = uuidv4();
    const guestEmail = `guest_${guestId}@temp.local`;
    const guestPassword = uuidv4();
    
    const userId = await createUser(guestEmail, guestPassword, '临时用户', ROLES.GUEST);
    const user = await findUserById(userId);
    const token = generateToken(user);
    
    res.status(201).json({
      message: '临时用户创建成功',
      token,
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        isGuest: true
      }
    });
  } catch (err) {
    console.error('创建临时用户失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
