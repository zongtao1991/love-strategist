const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('./index');

async function createConversation(userId, data) {
  const id = uuidv4();
  await run(
    `INSERT INTO conversations 
     (id, user_id, my_gender, my_personality, ta_gender, ta_personality, stage, engine_type)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      data.myGender || 's',
      data.myPersonality || 'gentle',
      data.taGender || 's',
      data.taPersonality || 'gentle',
      data.stage || 'strangers',
      data.engineType || 'local'
    ]
  );
  return id;
}

async function getConversation(conversationId, userId = null) {
  let sql = 'SELECT * FROM conversations WHERE id = ?';
  const params = [conversationId];
  
  if (userId) {
    sql += ' AND user_id = ?';
    params.push(userId);
  }
  
  return get(sql, params);
}

async function getUserConversations(userId, limit = 50, offset = 0) {
  return all(
    `SELECT * FROM conversations WHERE user_id = ? 
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset]
  );
}

async function deleteConversation(conversationId, userId) {
  await run('DELETE FROM messages WHERE conversation_id = ?', [conversationId]);
  const result = await run(
    'DELETE FROM conversations WHERE id = ? AND user_id = ?',
    [conversationId, userId]
  );
  return result.changes > 0;
}

async function addMessage(conversationId, who, text, msgType = null) {
  const id = uuidv4();
  await run(
    'INSERT INTO messages (id, conversation_id, who, text, msg_type) VALUES (?, ?, ?, ?, ?)',
    [id, conversationId, who, text, msgType]
  );
  return id;
}

async function getMessages(conversationId, limit = 100, offset = 0) {
  return all(
    `SELECT * FROM messages WHERE conversation_id = ? 
     ORDER BY created_at ASC LIMIT ? OFFSET ?`,
    [conversationId, limit, offset]
  );
}

async function getLastMessages(conversationId, count = 10) {
  const rows = await all(
    `SELECT * FROM messages WHERE conversation_id = ? 
     ORDER BY created_at DESC LIMIT ?`,
    [conversationId, count]
  );
  return rows.reverse();
}

async function getUserSettings(userId) {
  let settings = await get('SELECT * FROM settings WHERE user_id = ?', [userId]);
  
  if (!settings) {
    const id = uuidv4();
    await run(
      `INSERT INTO settings 
       (id, user_id, ai_provider, ai_timeout, ai_temperature, ai_style, ai_use_fallback, remote_anonymous, remote_quick_chat, remote_nick, remote_timeout, remote_pref, remote_gender_pref)
       VALUES (?, ?, 'openai', 30, 0.8, 'default', 1, 1, 1, '匿名用户', 60, 'personality', 'any')`,
      [id, userId]
    );
    settings = await get('SELECT * FROM settings WHERE user_id = ?', [userId]);
  }
  
  return {
    aiProvider: settings.ai_provider || 'openai',
    aiKey: settings.ai_key || '',
    aiEndpoint: settings.ai_endpoint || '',
    aiModel: settings.ai_model || '',
    aiTimeout: settings.ai_timeout || 30,
    aiTemperature: settings.ai_temperature || 0.8,
    aiStyle: settings.ai_style || 'default',
    aiSysPrompt: settings.ai_sys_prompt || '',
    aiUseFallback: settings.ai_use_fallback === 1,
    remoteUrl: settings.remote_url || '',
    remoteNick: settings.remote_nick || '匿名用户',
    remotePref: settings.remote_pref || 'personality',
    remoteGenderPref: settings.remote_gender_pref || 'any',
    remoteTimeout: settings.remote_timeout || 60,
    remoteAnonymous: settings.remote_anonymous === 1,
    remoteQuickChat: settings.remote_quick_chat === 1,
    avatarUrl: settings.avatar_url || '',
    voiceUrl: settings.voice_url || ''
  };
}

async function updateUserSettings(userId, data) {
  const existing = await get('SELECT id FROM settings WHERE user_id = ?', [userId]);
  
  if (existing) {
    const updates = [];
    const values = [];
    
    const fieldMap = {
      aiProvider: 'ai_provider',
      aiKey: 'ai_key',
      aiEndpoint: 'ai_endpoint',
      aiModel: 'ai_model',
      aiTimeout: 'ai_timeout',
      aiTemperature: 'ai_temperature',
      aiStyle: 'ai_style',
      aiSysPrompt: 'ai_sys_prompt',
      aiUseFallback: 'ai_use_fallback',
      remoteUrl: 'remote_url',
      remoteNick: 'remote_nick',
      remotePref: 'remote_pref',
      remoteGenderPref: 'remote_gender_pref',
      remoteTimeout: 'remote_timeout',
      remoteAnonymous: 'remote_anonymous',
      remoteQuickChat: 'remote_quick_chat',
      avatarUrl: 'avatar_url',
      voiceUrl: 'voice_url'
    };
    
    for (const [key, dbField] of Object.entries(fieldMap)) {
      if (data[key] !== undefined) {
        updates.push(`${dbField} = ?`);
        const val = typeof data[key] === 'boolean' ? (data[key] ? 1 : 0) : data[key];
        values.push(val);
      }
    }
    
    if (updates.length > 0) {
      updates.push('updated_at = datetime("now")');
      values.push(userId);
      await run(
        `UPDATE settings SET ${updates.join(', ')} WHERE user_id = ?`,
        values
      );
    }
  } else {
    const id = uuidv4();
    await run(
      `INSERT INTO settings 
       (id, user_id, ai_provider, ai_key, ai_endpoint, ai_model, ai_timeout, ai_temperature, ai_style, ai_sys_prompt, ai_use_fallback, remote_url, remote_nick, remote_pref, remote_gender_pref, remote_timeout, remote_anonymous, remote_quick_chat, avatar_url, voice_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        userId,
        data.aiProvider || 'openai',
        data.aiKey || '',
        data.aiEndpoint || '',
        data.aiModel || '',
        data.aiTimeout || 30,
        data.aiTemperature || 0.8,
        data.aiStyle || 'default',
        data.aiSysPrompt || '',
        data.aiUseFallback === true ? 1 : 0,
        data.remoteUrl || '',
        data.remoteNick || '匿名用户',
        data.remotePref || 'personality',
        data.remoteGenderPref || 'any',
        data.remoteTimeout || 60,
        data.remoteAnonymous !== false ? 1 : 0,
        data.remoteQuickChat !== false ? 1 : 0,
        data.avatarUrl || '',
        data.voiceUrl || ''
      ]
    );
  }
  
  return true;
}

module.exports = {
  createConversation,
  getConversation,
  getUserConversations,
  deleteConversation,
  addMessage,
  getMessages,
  getLastMessages,
  getUserSettings,
  updateUserSettings
};
