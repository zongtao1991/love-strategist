const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { requireUser } = require('../middleware/rbac');
const { findUserById, checkQuota, getAllUsers, updateUserRole, ROLES } = require('../models/user');
const { getUserConversations, deleteConversation, getMessages, getConversation } = require('../models/conversation');

const router = express.Router();

router.get('/conversations', authMiddleware, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    const conversations = await getUserConversations(req.user.id, parseInt(limit), parseInt(offset));
    
    res.json(conversations.map(c => ({
      id: c.id,
      myGender: c.my_gender,
      myPersonality: c.my_personality,
      taGender: c.ta_gender,
      taPersonality: c.ta_personality,
      stage: c.stage,
      engineType: c.engine_type,
      createdAt: c.created_at
    })));
  } catch (err) {
    console.error('获取会话列表失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/conversations/:id', authMiddleware, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const conv = await getConversation(conversationId, req.user.id);
    
    if (!conv) {
      return res.status(404).json({ error: '会话不存在或无权访问' });
    }
    
    const messages = await getMessages(conversationId);
    
    res.json({
      conversation: {
        id: conv.id,
        myGender: conv.my_gender,
        myPersonality: conv.my_personality,
        taGender: conv.ta_gender,
        taPersonality: conv.ta_personality,
        stage: conv.stage,
        engineType: conv.engine_type,
        createdAt: conv.created_at
      },
      messages: messages.map(m => ({
        id: m.id,
        who: m.who,
        text: m.text,
        type: m.msg_type,
        createdAt: m.created_at
      }))
    });
  } catch (err) {
    console.error('获取会话详情失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.delete('/conversations/:id', authMiddleware, async (req, res) => {
  try {
    const conversationId = req.params.id;
    const success = await deleteConversation(conversationId, req.user.id);
    
    if (!success) {
      return res.status(404).json({ error: '会话不存在或无权删除' });
    }
    
    res.json({ message: '会话已删除' });
  } catch (err) {
    console.error('删除会话失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    const quota = await checkQuota(req.user.id);
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        createdAt: user.created_at,
        lastLogin: user.last_login
      },
      quota
    });
  } catch (err) {
    console.error('获取用户信息失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { nickname } = req.body;
    const { run } = require('../models');
    
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

router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const { findUserByEmail, validatePassword } = require('../models/user');
    const bcrypt = require('bcryptjs');
    const { run } = require('../models');
    
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '旧密码和新密码不能为空' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码至少需要6个字符' });
    }
    
    const user = await findUserByEmail(req.user.email);
    const isValid = await validatePassword(user, oldPassword);
    
    if (!isValid) {
      return res.status(400).json({ error: '旧密码错误' });
    }
    
    const hashedPassword = bcrypt.hashSync(newPassword, 10);
    await run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.user.id]);
    
    res.json({ message: '密码更新成功' });
  } catch (err) {
    console.error('更新密码失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
