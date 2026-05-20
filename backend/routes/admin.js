const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const { requireAdmin, ROLES, getAllPermissions, updatePermissions } = require('../middleware/rbac');
const { getAllUsers, updateUserRole, findUserById, QUOTA_LIMITS } = require('../models/user');
const { getMatchingStats } = require('../engines/remote');
const { run, get, all } = require('../models');

const router = express.Router();

router.use(authMiddleware);
router.use(requireAdmin);

router.get('/dashboard', async (req, res) => {
  try {
    const [users, conversations, messages, matchStats] = await Promise.all([
      get('SELECT COUNT(*) as count FROM users'),
      get('SELECT COUNT(*) as count FROM conversations'),
      get('SELECT COUNT(*) as count FROM messages'),
      getMatchingStats()
    ]);
    
    const today = new Date().toISOString().split('T')[0];
    const todayMessages = await get(
      'SELECT COUNT(*) as count FROM messages WHERE date(created_at) = ?',
      [today]
    );
    
    const todayUsers = await get(
      'SELECT COUNT(DISTINCT user_id) as count FROM conversations WHERE date(created_at) = ?',
      [today]
    );
    
    res.json({
      totalUsers: users.count,
      totalConversations: conversations.count,
      totalMessages: messages.count,
      todayMessages: todayMessages.count,
      todayActiveUsers: todayUsers.count,
      matchingStats: {
        matchingPool: matchStats.matchingPool,
        activeMatches: matchStats.activeMatches,
        connectedUsers: matchStats.connectedUsers
      }
    });
  } catch (err) {
    console.error('获取仪表盘数据失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/users', async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;
    const users = await getAllUsers(parseInt(limit), parseInt(offset));
    
    res.json(users.map(u => ({
      id: u.id,
      email: u.email,
      nickname: u.nickname,
      role: u.role,
      createdAt: u.created_at,
      lastLogin: u.last_login,
      quota: {
        limit: u.daily_limit,
        used: u.daily_used,
        lastReset: u.last_reset
      }
    })));
  } catch (err) {
    console.error('获取用户列表失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await findUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    
    const quota = await get('SELECT * FROM quotas WHERE user_id = ?', [userId]);
    const conversations = await all(
      'SELECT * FROM conversations WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
      [userId]
    );
    
    res.json({
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        role: user.role,
        createdAt: user.created_at,
        lastLogin: user.last_login
      },
      quota: quota ? {
        limit: quota.daily_limit,
        used: quota.daily_used,
        lastReset: quota.last_reset
      } : null,
      recentConversations: conversations.map(c => ({
        id: c.id,
        taPersonality: c.ta_personality,
        stage: c.stage,
        engineType: c.engine_type,
        createdAt: c.created_at
      }))
    });
  } catch (err) {
    console.error('获取用户详情失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.put('/users/:id/role', async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;
    
    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }
    
    if (userId === req.user.id) {
      return res.status(400).json({ error: '不能修改自己的角色' });
    }
    
    await updateUserRole(userId, role);
    
    res.json({
      message: '角色更新成功',
      role,
      quotaLimit: QUOTA_LIMITS[role]
    });
  } catch (err) {
    console.error('更新用户角色失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.put('/users/:id/quota', async (req, res) => {
  try {
    const userId = req.params.id;
    const { dailyLimit, reset } = req.body;
    
    if (reset) {
      await run(
        'UPDATE quotas SET daily_used = 0, last_reset = date("now") WHERE user_id = ?',
        [userId]
      );
    }
    
    if (dailyLimit !== undefined) {
      await run(
        'UPDATE quotas SET daily_limit = ? WHERE user_id = ?',
        [parseInt(dailyLimit), userId]
      );
    }
    
    const quota = await get('SELECT * FROM quotas WHERE user_id = ?', [userId]);
    
    res.json({
      message: '配额更新成功',
      quota: {
        limit: quota.daily_limit,
        used: quota.daily_used,
        lastReset: quota.last_reset
      }
    });
  } catch (err) {
    console.error('更新用户配额失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/conversations', async (req, res) => {
  try {
    const { limit = 100, offset = 0, userId } = req.query;
    
    let sql = `SELECT c.*, u.email, u.nickname 
               FROM conversations c 
               LEFT JOIN users u ON c.user_id = u.id`;
    const params = [];
    
    if (userId) {
      sql += ' WHERE c.user_id = ?';
      params.push(userId);
    }
    
    sql += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const conversations = await all(sql, params);
    
    res.json(conversations.map(c => ({
      id: c.id,
      userId: c.user_id,
      userEmail: c.email,
      userNickname: c.nickname,
      myPersonality: c.my_personality,
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

router.get('/personalities', async (req, res) => {
  try {
    const { includeCustom = false } = req.query;
    
    let sql = 'SELECT * FROM personalities WHERE 1=1';
    const params = [];
    
    if (includeCustom !== 'true') {
      sql += ' AND is_custom = 0';
    }
    
    sql += ' ORDER BY is_custom, created_at';
    
    const personalities = await all(sql, params);
    
    res.json(personalities.map(p => ({
      id: p.id,
      key: p.key,
      name: p.name,
      emoji: p.emoji,
      description: p.description,
      isCustom: p.is_custom === 1,
      createdBy: p.created_by,
      createdAt: p.created_at
    })));
  } catch (err) {
    console.error('获取人格列表失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.delete('/personalities/:key', async (req, res) => {
  try {
    const key = req.params.key;
    
    const personality = await get('SELECT * FROM personalities WHERE key = ?', [key]);
    if (!personality) {
      return res.status(404).json({ error: '人格不存在' });
    }
    
    if (personality.is_custom === 0) {
      return res.status(400).json({ error: '不能删除系统默认人格' });
    }
    
    await run('DELETE FROM personalities WHERE key = ?', [key]);
    
    res.json({ message: '人格已删除' });
  } catch (err) {
    console.error('删除人格失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/stats/messages', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const stats = await all(`
      SELECT 
        date(created_at) as date,
        COUNT(*) as count,
        COUNT(DISTINCT conversation_id) as conversations
      FROM messages 
      WHERE date(created_at) >= date('now', '-' || ? || ' days')
      GROUP BY date(created_at)
      ORDER BY date(created_at)
    `, [parseInt(days)]);
    
    res.json(stats);
  } catch (err) {
    console.error('获取消息统计失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/stats/users', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    
    const stats = await all(`
      SELECT 
        date(created_at) as date,
        COUNT(*) as new_users
      FROM users 
      WHERE date(created_at) >= date('now', '-' || ? || ' days')
      GROUP BY date(created_at)
      ORDER BY date(created_at)
    `, [parseInt(days)]);
    
    const roleStats = await all(`
      SELECT role, COUNT(*) as count FROM users GROUP BY role
    `);
    
    res.json({
      dailyNew: stats,
      byRole: roleStats
    });
  } catch (err) {
    console.error('获取用户统计失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/permissions', async (req, res) => {
  try {
    const permissions = await getAllPermissions();
    res.json({
      permissions,
      roles: Object.values(ROLES)
    });
  } catch (err) {
    console.error('获取权限配置失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.put('/permissions', async (req, res) => {
  try {
    const { role, resource, actions } = req.body;
    
    if (!role || !resource || !Array.isArray(actions)) {
      return res.status(400).json({ 
        error: '参数错误：需要 role, resource, actions（数组）' 
      });
    }
    
    if (!Object.values(ROLES).includes(role)) {
      return res.status(400).json({ error: '无效的角色' });
    }
    
    await updatePermissions(role, resource, actions);
    
    const updatedPermissions = await getAllPermissions();
    
    res.json({
      message: '权限配置已更新',
      permissions: updatedPermissions
    });
  } catch (err) {
    console.error('更新权限配置失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.put('/permissions/batch', async (req, res) => {
  try {
    const { permissions } = req.body;
    
    if (!permissions || typeof permissions !== 'object') {
      return res.status(400).json({ error: '参数错误：需要 permissions 对象' });
    }
    
    for (const [role, resources] of Object.entries(permissions)) {
      if (!Object.values(ROLES).includes(role)) continue;
      
      for (const [resource, actions] of Object.entries(resources)) {
        if (!Array.isArray(actions)) continue;
        await updatePermissions(role, resource, actions);
      }
    }
    
    const updatedPermissions = await getAllPermissions();
    
    res.json({
      message: '权限配置已批量更新',
      permissions: updatedPermissions
    });
  } catch (err) {
    console.error('批量更新权限配置失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
