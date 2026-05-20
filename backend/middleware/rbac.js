const { ROLES, all, run, get } = require('../models');

const ROLE_HIERARCHY = {
  [ROLES.GUEST]: 0,
  [ROLES.USER]: 1,
  [ROLES.PREMIUM]: 2,
  [ROLES.ADMIN]: 3
};

let CACHED_PERMISSIONS = {};

async function loadPermissions() {
  const rows = await all('SELECT role, resource, actions FROM role_permissions');
  const perms = {};
  
  for (const row of rows) {
    if (!perms[row.role]) {
      perms[row.role] = {};
    }
    try {
      perms[row.role][row.resource] = JSON.parse(row.actions);
    } catch (e) {
      perms[row.role][row.resource] = [];
    }
  }
  
  CACHED_PERMISSIONS = perms;
  console.log('✅ 权限配置已加载');
}

async function updatePermissions(role, resource, actions) {
  const existing = await get(
    'SELECT id FROM role_permissions WHERE role = ? AND resource = ?',
    [role, resource]
  );
  
  if (existing) {
    await run(
      'UPDATE role_permissions SET actions = ?, updated_at = datetime("now") WHERE role = ? AND resource = ?',
      [JSON.stringify(actions), role, resource]
    );
  } else {
    const { v4: uuidv4 } = require('uuid');
    await run(
      'INSERT INTO role_permissions (id, role, resource, actions) VALUES (?, ?, ?, ?)',
      [uuidv4(), role, resource, JSON.stringify(actions)]
    );
  }
  
  if (!CACHED_PERMISSIONS[role]) {
    CACHED_PERMISSIONS[role] = {};
  }
  CACHED_PERMISSIONS[role][resource] = actions;
  
  return true;
}

async function getAllPermissions() {
  return { ...CACHED_PERMISSIONS };
}

function hasRequiredRole(userRole, requiredRole) {
  if (!requiredRole) return true;
  if (!userRole) return false;
  
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0;
  
  return userLevel >= requiredLevel;
}

function requireRole(requiredRole) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未授权，请先登录' });
    }
    
    if (!hasRequiredRole(req.user.role, requiredRole)) {
      return res.status(403).json({ error: '权限不足' });
    }
    
    next();
  };
}

const requireAdmin = requireRole(ROLES.ADMIN);
const requirePremium = requireRole(ROLES.PREMIUM);
const requireUser = requireRole(ROLES.USER);

function checkPermission(action, resource) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '未授权，请先登录' });
    }
    
    const role = req.user.role;
    
    const rolePerms = CACHED_PERMISSIONS[role] || CACHED_PERMISSIONS[ROLES.GUEST] || {};
    const resourcePerms = rolePerms[resource] || [];
    
    if (!resourcePerms.includes(action)) {
      return res.status(403).json({ error: `权限不足：缺少 ${resource}.${action} 权限` });
    }
    
    next();
  };
}

function canAccessConversation(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: '未授权，请先登录' });
  }
  
  const conversationId = req.params.conversationId || req.body.conversationId;
  
  if (!conversationId) {
    return res.status(400).json({ error: '缺少会话ID' });
  }
  
  req.conversationId = conversationId;
  next();
}

module.exports = {
  hasRequiredRole,
  requireRole,
  requireAdmin,
  requirePremium,
  requireUser,
  checkPermission,
  canAccessConversation,
  loadPermissions,
  updatePermissions,
  getAllPermissions,
  ROLES,
  ROLE_HIERARCHY
};
