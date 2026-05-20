const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const { run, get, all, ROLES } = require('./index');

const QUOTA_LIMITS = {
  [ROLES.ADMIN]: parseInt(process.env.DAILY_QUOTA_ADMIN) || 99999,
  [ROLES.PREMIUM]: parseInt(process.env.DAILY_QUOTA_PREMIUM) || 500,
  [ROLES.USER]: parseInt(process.env.DAILY_QUOTA_FREE) || 50,
  [ROLES.GUEST]: 10
};

async function createUser(email, password, nickname, role = ROLES.USER) {
  const id = uuidv4();
  const hashedPassword = bcrypt.hashSync(password, 10);
  
  await run(
    'INSERT INTO users (id, email, password, nickname, role) VALUES (?, ?, ?, ?, ?)',
    [id, email, hashedPassword, nickname || email.split('@')[0], role]
  );
  
  const quotaLimit = QUOTA_LIMITS[role] || QUOTA_LIMITS[ROLES.USER];
  await run(
    'INSERT INTO quotas (id, user_id, daily_limit, daily_used, last_reset) VALUES (?, ?, ?, 0, date("now"))',
    [uuidv4(), id, quotaLimit]
  );
  
  return id;
}

async function findUserById(id) {
  return get('SELECT id, email, nickname, role, created_at, last_login FROM users WHERE id = ?', [id]);
}

async function findUserByEmail(email) {
  return get('SELECT * FROM users WHERE email = ?', [email]);
}

async function validatePassword(user, password) {
  return bcrypt.compareSync(password, user.password);
}

async function updateLastLogin(userId) {
  return run('UPDATE users SET last_login = datetime("now") WHERE id = ?', [userId]);
}

async function getUserQuota(userId) {
  let quota = await get('SELECT * FROM quotas WHERE user_id = ?', [userId]);
  
  if (!quota) {
    const user = await findUserById(userId);
    const role = user?.role || ROLES.USER;
    const quotaLimit = QUOTA_LIMITS[role] || QUOTA_LIMITS[ROLES.USER];
    const quotaId = uuidv4();
    await run(
      'INSERT INTO quotas (id, user_id, daily_limit, daily_used, last_reset) VALUES (?, ?, ?, 0, date("now"))',
      [quotaId, userId, quotaLimit]
    );
    quota = { id: quotaId, user_id: userId, daily_limit: quotaLimit, daily_used: 0, last_reset: new Date().toISOString().split('T')[0] };
  }
  
  const today = new Date().toISOString().split('T')[0];
  if (quota.last_reset !== today) {
    const user = await findUserById(userId);
    const role = user?.role || ROLES.USER;
    const quotaLimit = QUOTA_LIMITS[role] || QUOTA_LIMITS[ROLES.USER];
    await run(
      'UPDATE quotas SET daily_used = 0, last_reset = date("now"), daily_limit = ? WHERE user_id = ?',
      [quotaLimit, userId]
    );
    quota = { ...quota, daily_used: 0, last_reset: today, daily_limit: quotaLimit };
  }
  
  return quota;
}

async function consumeQuota(userId) {
  const db = require('./index').db;
  
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE quotas
       SET daily_used = CASE
           WHEN last_reset != date('now') THEN 1
           ELSE daily_used + 1
         END,
         last_reset = date('now')
       WHERE user_id = ?
         AND (
           (last_reset = date('now') AND daily_used < daily_limit)
           OR
           (last_reset != date('now') AND 1 <= daily_limit)
         )`,
      [userId],
      function(err) {
        if (err) return reject(err);
        resolve({ success: this.changes === 1 });
      }
    );
  });
}

async function checkQuota(userId) {
  const quota = await getUserQuota(userId);
  return {
    limit: quota.daily_limit,
    used: quota.daily_used,
    remaining: quota.daily_limit - quota.daily_used,
    hasQuota: quota.daily_used < quota.daily_limit
  };
}

async function getAllUsers(limit = 100, offset = 0) {
  return all(
    `SELECT u.id, u.email, u.nickname, u.role, u.created_at, u.last_login,
            q.daily_limit, q.daily_used, q.last_reset
     FROM users u LEFT JOIN quotas q ON u.id = q.user_id
     ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
    [limit, offset]
  );
}

async function updateUserRole(userId, role) {
  if (!Object.values(ROLES).includes(role)) {
    throw new Error('无效的角色');
  }
  
  await run('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
  
  const quotaLimit = QUOTA_LIMITS[role] || QUOTA_LIMITS[ROLES.USER];
  await run('UPDATE quotas SET daily_limit = ? WHERE user_id = ?', [quotaLimit, userId]);
  
  return true;
}

module.exports = {
  createUser,
  findUserById,
  findUserByEmail,
  validatePassword,
  updateLastLogin,
  getUserQuota,
  consumeQuota,
  checkQuota,
  getAllUsers,
  updateUserRole,
  ROLES,
  QUOTA_LIMITS
};
