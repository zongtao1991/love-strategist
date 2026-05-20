const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || './data/love-strategist.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath);

const ROLES = {
  ADMIN: 'admin',
  PREMIUM: 'premium',
  USER: 'user',
  GUEST: 'guest'
};

function safeParse(value, defaultValue = {}) {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value;
  }
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (e) {
      return defaultValue;
    }
  }
  return defaultValue;
}

function safeParseArray(value, defaultValue = []) {
  const result = safeParse(value, defaultValue);
  return Array.isArray(result) ? result : defaultValue;
}

function safeParseObject(value, defaultValue = {}) {
  const result = safeParse(value, defaultValue);
  return typeof result === 'object' && !Array.isArray(result) ? result : defaultValue;
}

async function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

async function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

async function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDB() {
  const bcrypt = require('bcryptjs');
  const { v4: uuidv4 } = require('uuid');
  
  await runAsync(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      password TEXT,
      nickname TEXT,
      role TEXT DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS quotas (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE,
      daily_limit INTEGER DEFAULT 50,
      daily_used INTEGER DEFAULT 0,
      last_reset DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      my_gender TEXT,
      my_personality TEXT,
      ta_gender TEXT,
      ta_personality TEXT,
      stage TEXT,
      engine_type TEXT DEFAULT 'local',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT,
      who TEXT,
      text TEXT,
      msg_type TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS personalities (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE,
      name TEXT,
      emoji TEXT,
      description TEXT,
      open_lines TEXT,
      responses TEXT,
      tips TEXT,
      suggestions TEXT,
      warnings TEXT,
      is_custom INTEGER DEFAULT 0,
      created_by TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id)
    )
  `);

  await runAsync(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE,
      ai_provider TEXT DEFAULT 'openai',
      ai_key TEXT,
      ai_endpoint TEXT,
      ai_model TEXT,
      ai_timeout INTEGER DEFAULT 30,
      ai_temperature REAL DEFAULT 0.8,
      ai_style TEXT DEFAULT 'default',
      ai_sys_prompt TEXT,
      ai_use_fallback INTEGER DEFAULT 1,
      remote_url TEXT,
      remote_nick TEXT DEFAULT '匿名用户',
      remote_pref TEXT DEFAULT 'personality',
      remote_gender_pref TEXT DEFAULT 'any',
      remote_timeout INTEGER DEFAULT 60,
      remote_anonymous INTEGER DEFAULT 1,
      remote_quick_chat INTEGER DEFAULT 1,
      avatar_url TEXT,
      voice_url TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await runAsync(`CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id)`);
  await runAsync(`CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id)`);
  await runAsync(`CREATE INDEX IF NOT EXISTS idx_quotas_user ON quotas(user_id)`);
  await runAsync(`CREATE INDEX IF NOT EXISTS idx_personalities_key ON personalities(key)`);
  
  await runAsync(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL,
      resource TEXT NOT NULL,
      actions TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(role, resource)
    )
  `);
  
  await runAsync(`CREATE INDEX IF NOT EXISTS idx_role_perms_role ON role_permissions(role)`);

  const permCount = await getAsync('SELECT COUNT(*) as cnt FROM role_permissions');
  if (!permCount || permCount.cnt === 0) {
    const defaultPermissions = {
      [ROLES.GUEST]: {
        chat: ['read'],
        personality: ['read']
      },
      [ROLES.USER]: {
        chat: ['read', 'write'],
        personality: ['read', 'create_custom'],
        settings: ['read', 'write'],
        conversations: ['read', 'write', 'delete_own']
      },
      [ROLES.PREMIUM]: {
        chat: ['read', 'write', 'ai_engine', 'priority'],
        personality: ['read', 'write', 'create_custom', 'edit_own'],
        settings: ['read', 'write', 'advanced'],
        conversations: ['read', 'write', 'delete_own', 'export']
      },
      [ROLES.ADMIN]: {
        chat: ['read', 'write', 'ai_engine', 'priority', 'moderate'],
        personality: ['read', 'write', 'create_custom', 'edit_own', 'edit_all', 'delete_all'],
        settings: ['read', 'write', 'advanced', 'system'],
        conversations: ['read', 'write', 'delete_own', 'delete_all', 'export'],
        users: ['read', 'write', 'delete', 'manage_roles'],
        quotas: ['read', 'write', 'reset']
      }
    };
    
    for (const [role, resources] of Object.entries(defaultPermissions)) {
      for (const [resource, actions] of Object.entries(resources)) {
        await runAsync(
          'INSERT INTO role_permissions (id, role, resource, actions) VALUES (?, ?, ?, ?)',
          [uuidv4(), role, resource, JSON.stringify(actions)]
        );
      }
    }
    console.log('✅ 默认权限已初始化');
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@love-strategist.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  const existingAdmin = await getAsync('SELECT id FROM users WHERE email = ?', [adminEmail]);
  
  if (!existingAdmin) {
    const hashedPassword = bcrypt.hashSync(adminPassword, 10);
    const adminId = uuidv4();
    
    await runAsync(
      'INSERT INTO users (id, email, password, nickname, role) VALUES (?, ?, ?, ?, ?)',
      [adminId, adminEmail, hashedPassword, '系统管理员', ROLES.ADMIN]
    );
    
    await runAsync(
      'INSERT INTO quotas (id, user_id, daily_limit) VALUES (?, ?, ?)',
      [uuidv4(), adminId, parseInt(process.env.DAILY_QUOTA_ADMIN) || 99999]
    );
    
    console.log('✅ 管理员用户已创建:', adminEmail);
  }

  console.log('✅ 数据库初始化完成');
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = {
  db,
  ROLES,
  initDB,
  run,
  get,
  all,
  safeParse,
  safeParseArray,
  safeParseObject
};
