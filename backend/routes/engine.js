const express = require('express');
const { authMiddleware, optionalAuth } = require('../middleware/auth');
const { checkPermission } = require('../middleware/rbac');
const { generateReply, generateAdvice, generateSimulation, AIEngine } = require('../engines');
const { consumeQuota, checkQuota, ROLES } = require('../models/user');
const { 
  createConversation, getConversation, addMessage, getLastMessages,
  getUserSettings, updateUserSettings 
} = require('../models/conversation');
const { 
  getAllPersonalities, getPersonality, STAGES, SCENARIOS, classify, pick,
  createCustomPersonality, updateCustomPersonality, deleteCustomPersonality
} = require('../models/personality');

const router = express.Router();

router.get('/personalities', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.id;
    const personalities = await getAllPersonalities(true, userId);
    
    const result = Object.entries(personalities).map(([key, p]) => ({
      key,
      name: p.name,
      emoji: p.emoji,
      description: p.description,
      isCustom: p.isCustom,
      createdBy: p.createdBy
    }));
    
    res.json(result);
  } catch (err) {
    console.error('获取人格列表失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/personalities/:key', async (req, res) => {
  try {
    const key = req.params.key;
    const personality = await getPersonality(key);
    
    if (!personality) {
      return res.status(404).json({ error: '人格不存在' });
    }
    
    res.json({
      key,
      name: personality.name,
      emoji: personality.emoji,
      description: personality.description,
      open: personality.open,
      responses: personality.r,
      tips: personality.tip,
      suggestions: personality.sug,
      warnings: personality.warn,
      isCustom: personality.isCustom
    });
  } catch (err) {
    console.error('获取人格详情失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/stages', (req, res) => {
  res.json(STAGES);
});

router.get('/scenarios', (req, res) => {
  const result = Object.entries(SCENARIOS).map(([key, s]) => ({
    key,
    turns: s.map(t => ({ who: t.w, type: t.t, comment: t.c }))
  }));
  res.json(result);
});

router.get('/ai-providers', (req, res) => {
  const providers = AIEngine.getSupportedProviders();
  res.json(providers);
});

router.post('/personalities', authMiddleware, async (req, res) => {
  try {
    const data = req.body;
    
    if (!data.name || !data.description) {
      return res.status(400).json({ error: '人格名称和描述不能为空' });
    }
    
    const key = await createCustomPersonality(req.user.id, data);
    const personality = await getPersonality(key);
    
    res.status(201).json({
      message: '自定义人格创建成功',
      personality: {
        key,
        name: personality.name,
        emoji: personality.emoji,
        description: personality.description,
        isCustom: true
      }
    });
  } catch (err) {
    console.error('创建自定义人格失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.put('/personalities/:key', authMiddleware, async (req, res) => {
  try {
    const key = req.params.key;
    const data = req.body;
    
    const success = await updateCustomPersonality(key, req.user.id, data);
    
    if (!success) {
      return res.status(404).json({ error: '人格不存在或无权修改' });
    }
    
    res.json({ message: '人格更新成功' });
  } catch (err) {
    console.error('更新人格失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.delete('/personalities/:key', authMiddleware, async (req, res) => {
  try {
    const key = req.params.key;
    const success = await deleteCustomPersonality(key, req.user.id);
    
    if (!success) {
      return res.status(404).json({ error: '人格不存在或无权删除' });
    }
    
    res.json({ message: '人格删除成功' });
  } catch (err) {
    console.error('删除人格失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/conversations', authMiddleware, async (req, res) => {
  try {
    const { myGender, myPersonality, taGender, taPersonality, stage, engineType } = req.body;
    
    const conversationId = await createConversation(req.user.id, {
      myGender, myPersonality, taGender, taPersonality, stage,
      engineType: engineType || 'local'
    });
    
    const conversation = await getConversation(conversationId);
    const personality = await getPersonality(taPersonality);
    const opening = personality ? pick(personality.open) : '你好呀～';
    
    await addMessage(conversationId, 'ta', opening, classify(opening));
    
    res.status(201).json({
      message: '会话创建成功',
      conversation: {
        id: conversation.id,
        myGender: conversation.my_gender,
        myPersonality: conversation.my_personality,
        taGender: conversation.ta_gender,
        taPersonality: conversation.ta_personality,
        stage: conversation.stage,
        engineType: conversation.engine_type,
        createdAt: conversation.created_at
      },
      openingMessage: {
        who: 'ta',
        text: opening,
        type: classify(opening)
      }
    });
  } catch (err) {
    console.error('创建会话失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/reply', authMiddleware, async (req, res) => {
  try {
    const { conversationId, message, myGender, myPersonality, taGender, taPersonality, stage, engineType } = req.body;
    
    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: '消息不能为空' });
    }
    
    const quotaResult = await consumeQuota(req.user.id);
    if (!quotaResult.success) {
      const quotaInfo = await checkQuota(req.user.id);
      return res.status(429).json({
        error: '今日配额已用完',
        remaining: 0,
        limit: quotaInfo.limit
      });
    }
    
    let convId = conversationId;
    let history = [];
    
    if (convId) {
      const conv = await getConversation(convId, req.user.id);
      if (!conv) {
        return res.status(404).json({ error: '会话不存在或无权访问' });
      }
      
      await addMessage(convId, 'me', message, classify(message));
      history = await getLastMessages(convId, 10);
    } else {
      convId = await createConversation(req.user.id, {
        myGender, myPersonality, taGender, taPersonality, stage,
        engineType: engineType || 'local'
      });
      await addMessage(convId, 'me', message, classify(message));
    }
    
    const conv = await getConversation(convId);
    const settings = await getUserSettings(req.user.id);
    
    const ctx = {
      lastMsg: message,
      myGender: conv.my_gender,
      myPersonality: conv.my_personality,
      taGender: conv.ta_gender,
      taPersonality: conv.ta_personality,
      stage: conv.stage,
      history: history.map(h => ({ who: h.who, text: h.text }))
    };
    
    const engine = conv.engine_type || engineType || 'local';
    const result = await generateReply(engine, ctx, settings);
    
    await addMessage(convId, 'ta', result.text, result.msgType);
    
    const updatedQuota = await checkQuota(req.user.id);
    
    res.json({
      conversationId: convId,
      reply: {
        text: result.text,
        type: result.msgType,
        engine: result.engine
      },
      quota: {
        limit: updatedQuota.limit,
        used: updatedQuota.used,
        remaining: updatedQuota.remaining
      }
    });
  } catch (err) {
    console.error('生成回复失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/advise', authMiddleware, async (req, res) => {
  try {
    const { conversationId, taMessage, myGender, myPersonality, taGender, taPersonality, stage, engineType, msgType } = req.body;
    
    if (!taMessage) {
      return res.status(400).json({ error: '对方消息不能为空' });
    }
    
    let history = [];
    let convCtx = { myGender, myPersonality, taGender, taPersonality, stage };
    
    if (conversationId) {
      const conv = await getConversation(conversationId, req.user.id);
      if (conv) {
        convCtx = {
          myGender: conv.my_gender,
          myPersonality: conv.my_personality,
          taGender: conv.ta_gender,
          taPersonality: conv.ta_personality,
          stage: conv.stage
        };
        history = await getLastMessages(conversationId, 10);
      }
    }
    
    const settings = await getUserSettings(req.user.id);
    const engine = engineType || 'local';
    
    const ctx = {
      taPersonality: convCtx.taPersonality,
      stage: convCtx.stage,
      msgType: msgType || classify(taMessage),
      lastTaMsg: taMessage,
      history: history.map(h => ({ who: h.who, text: h.text })),
      myPersonality: convCtx.myPersonality,
      myGender: convCtx.myGender,
      taGender: convCtx.taGender
    };
    
    const advice = await generateAdvice(engine, ctx, settings);
    
    res.json(advice);
  } catch (err) {
    console.error('生成建议失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.post('/simulate', authMiddleware, async (req, res) => {
  try {
    const { scenarioKey, myPersonality, taPersonality, myGender, taGender, stage, engineType } = req.body;
    
    if (!scenarioKey || !SCENARIOS[scenarioKey]) {
      return res.status(400).json({ error: '无效的场景' });
    }
    
    const quotaResult = await consumeQuota(req.user.id);
    if (!quotaResult.success) {
      const quotaInfo = await checkQuota(req.user.id);
      return res.status(429).json({
        error: '今日配额已用完',
        remaining: 0,
        limit: quotaInfo.limit
      });
    }
    
    const settings = await getUserSettings(req.user.id);
    const engine = engineType || 'local';
    
    const ctx = {
      myPersonality: myPersonality || 'gentle',
      taPersonality: taPersonality || 'gentle',
      myGender: myGender || 's',
      taGender: taGender || 's',
      stage: stage || 'strangers'
    };
    
    const simulation = await generateSimulation(engine, scenarioKey, ctx, settings);
    const updatedQuota = await checkQuota(req.user.id);
    
    res.json({
      scenario: scenarioKey,
      turns: simulation,
      quota: {
        limit: updatedQuota.limit,
        used: updatedQuota.used,
        remaining: updatedQuota.remaining
      }
    });
  } catch (err) {
    console.error('生成模拟对话失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/quota', authMiddleware, async (req, res) => {
  try {
    const quota = await checkQuota(req.user.id);
    res.json(quota);
  } catch (err) {
    console.error('获取配额信息失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.get('/settings', authMiddleware, async (req, res) => {
  try {
    const settings = await getUserSettings(req.user.id);
    res.json(settings);
  } catch (err) {
    console.error('获取设置失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

router.put('/settings', authMiddleware, async (req, res) => {
  try {
    const data = req.body;
    await updateUserSettings(req.user.id, data);
    
    const updated = await getUserSettings(req.user.id);
    res.json({
      message: '设置更新成功',
      settings: updated
    });
  } catch (err) {
    console.error('更新设置失败:', err);
    res.status(500).json({ error: '服务器错误' });
  }
});

module.exports = router;
