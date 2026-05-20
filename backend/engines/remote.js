const { v4: uuidv4 } = require('uuid');
const { classify, pick, getPersonality, genderName } = require('../models/personality');
const { LocalEngine } = require('./local');

const REMOTE_STATE = {
  IDLE: 'idle',
  CONNECTING: 'connecting',
  MATCHING: 'matching',
  MATCHED: 'matched',
  CHATTING: 'chatting',
  DISCONNECTED: 'disconnected',
  ERROR: 'error'
};

const MATCHING_POOL = new Map();
const ACTIVE_MATCHES = new Map();
const USER_CONNECTIONS = new Map();

let wss = null;

function setupWebSocket(webSocketServer) {
  wss = webSocketServer;
  
  wss.on('connection', (ws, req) => {
    const userId = req.headers['x-user-id'] || uuidv4();
    const connectionId = uuidv4();
    
    console.log(`[WebSocket] 新连接: userId=${userId}, connId=${connectionId}`);
    
    ws.userId = userId;
    ws.connectionId = connectionId;
    ws.state = REMOTE_STATE.IDLE;
    ws.matchedPartner = null;
    
    if (!USER_CONNECTIONS.has(userId)) {
      USER_CONNECTIONS.set(userId, new Set());
    }
    USER_CONNECTIONS.get(userId).add(ws);
    
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        handleMessage(ws, msg);
      } catch (err) {
        console.error('消息解析失败:', err);
        sendError(ws, '消息格式错误');
      }
    });
    
    ws.on('close', () => {
      console.log(`[WebSocket] 连接关闭: userId=${userId}`);
      handleDisconnect(ws);
    });
    
    ws.on('error', (err) => {
      console.error('WebSocket错误:', err);
      handleDisconnect(ws);
    });
    
    sendToClient(ws, {
      type: 'connected',
      connectionId,
      message: '已连接到匹配服务器'
    });
  });
}

function handleMessage(ws, msg) {
  switch (msg.type) {
    case 'match':
      handleMatchRequest(ws, msg);
      break;
    case 'message':
      handleChatMessage(ws, msg);
      break;
    case 'advise':
      handleAdviseRequest(ws, msg);
      break;
    case 'cancel_match':
      handleCancelMatch(ws);
      break;
    case 'leave':
      handleLeave(ws);
      break;
    default:
      sendError(ws, `未知消息类型: ${msg.type}`);
  }
}

function handleMatchRequest(ws, msg) {
  const persona = msg.persona || {};
  const preference = msg.preference || 'personality';
  const genderPref = msg.genderPref || 'any';
  const nick = msg.nick || '匿名用户';
  const quickMatch = msg.quickMatch !== false;
  
  ws.state = REMOTE_STATE.MATCHING;
  ws.persona = persona;
  ws.preference = preference;
  ws.genderPref = genderPref;
  ws.nick = nick;
  ws.quickMatch = quickMatch;
  
  MATCHING_POOL.set(ws.connectionId, ws);
  
  sendToClient(ws, {
    type: 'matching',
    info: '正在寻找匹配对象...',
    poolSize: MATCHING_POOL.size
  });
  
  tryMatch(ws);
}

function tryMatch(ws) {
  const candidates = Array.from(MATCHING_POOL.values()).filter(c => 
    c.connectionId !== ws.connectionId && 
    c.state === REMOTE_STATE.MATCHING
  );
  
  if (candidates.length === 0) return;
  
  let bestMatch = null;
  let bestScore = -1;
  
  for (const candidate of candidates) {
    const score = calculateMatchScore(ws, candidate);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }
  
  if (bestMatch && bestScore >= 0.3) {
    createMatch(ws, bestMatch);
  }
}

function calculateMatchScore(ws1, ws2) {
  let score = 0;
  
  if (ws1.genderPref !== 'any' && ws2.persona?.gender) {
    if (ws1.genderPref === ws2.persona.gender) {
      score += 0.3;
    } else {
      return -1;
    }
  }
  
  if (ws2.genderPref !== 'any' && ws1.persona?.gender) {
    if (ws2.genderPref === ws1.persona.gender) {
      score += 0.3;
    } else {
      return -1;
    }
  }
  
  const p1 = ws1.persona?.personality;
  const p2 = ws2.persona?.personality;
  
  if (p1 && p2) {
    if (ws1.preference === 'same' && p1 === p2) {
      score += 0.4;
    } else if (ws1.preference === 'compatible') {
      score += getCompatibilityScore(p1, p2) * 0.4;
    } else if (p1 !== p2) {
      score += 0.4;
    }
  }
  
  const s1 = ws1.persona?.stage;
  const s2 = ws2.persona?.stage;
  if (s1 === s2) {
    score += 0.2;
  }
  
  score += Math.random() * 0.1;
  
  return score;
}

function getCompatibilityScore(p1, p2) {
  const compatibility = {
    'gentle+dominant': 0.9, 'dominant+gentle': 0.9,
    'cool+artistic': 0.85, 'artistic+cool': 0.85,
    'funny+serious': 0.8, 'serious+funny': 0.8,
    'sporty+gentle': 0.75, 'gentle+sporty': 0.75,
    'intellectual+artistic': 0.8, 'artistic+intellectual': 0.8,
    'tsundere+gentle': 0.85, 'gentle+tsundere': 0.85,
    'playful+mature': 0.75, 'mature+playful': 0.75,
    'sensitive+gentle': 0.9, 'gentle+sensitive': 0.9
  };
  
  return compatibility[`${p1}+${p2}`] || 0.5;
}

function createMatch(ws1, ws2) {
  const matchId = uuidv4();
  
  MATCHING_POOL.delete(ws1.connectionId);
  MATCHING_POOL.delete(ws2.connectionId);
  
  ws1.state = REMOTE_STATE.MATCHED;
  ws2.state = REMOTE_STATE.MATCHED;
  ws1.matchedPartner = ws2;
  ws2.matchedPartner = ws1;
  ws1.matchId = matchId;
  ws2.matchId = matchId;
  
  ACTIVE_MATCHES.set(matchId, { ws1, ws2, createdAt: Date.now() });
  
  const partner1Info = {
    nick: ws2.nick,
    persona: ws2.persona,
    matchId
  };
  
  const partner2Info = {
    nick: ws1.nick,
    persona: ws1.persona,
    matchId
  };
  
  sendToClient(ws1, {
    type: 'matched',
    partner: partner1Info,
    message: '匹配成功！可以开始聊天了'
  });
  
  sendToClient(ws2, {
    type: 'matched',
    partner: partner2Info,
    message: '匹配成功！可以开始聊天了'
  });
  
  console.log(`[Match] 匹配成功: matchId=${matchId}, ws1=${ws1.userId}, ws2=${ws2.userId}`);
}

function handleChatMessage(ws, msg) {
  if (ws.state !== REMOTE_STATE.MATCHED && ws.state !== REMOTE_STATE.CHATTING) {
    sendError(ws, '未匹配到聊天对象');
    return;
  }
  
  const partner = ws.matchedPartner;
  if (!partner || partner.readyState !== 1) {
    sendError(ws, '对方已离开');
    return;
  }
  
  ws.state = REMOTE_STATE.CHATTING;
  partner.state = REMOTE_STATE.CHATTING;
  
  const chatMsg = {
    type: 'message',
    text: msg.text,
    timestamp: msg.timestamp || Date.now(),
    from: 'partner'
  };
  
  sendToClient(partner, chatMsg);
}

async function handleAdviseRequest(ws, msg) {
  const localEngine = new LocalEngine();
  
  const ctx = {
    taPersonality: ws.matchedPartner?.persona?.personality || 'gentle',
    stage: ws.persona?.stage || 'strangers',
    msgType: classify(msg.lastTaMsg || ''),
    lastTaMsg: msg.lastTaMsg || '',
    history: msg.history || [],
    myPersonality: ws.persona?.personality || 'gentle',
    myGender: ws.persona?.gender || 's',
    taGender: ws.matchedPartner?.persona?.gender || 's'
  };
  
  const advice = await localEngine.advise(ctx);
  
  sendToClient(ws, {
    type: 'advise',
    ...advice
  });
}

function handleCancelMatch(ws) {
  if (ws.state === REMOTE_STATE.MATCHING) {
    MATCHING_POOL.delete(ws.connectionId);
    ws.state = REMOTE_STATE.IDLE;
    
    sendToClient(ws, {
      type: 'system',
      text: '已取消匹配'
    });
  }
}

function handleLeave(ws) {
  if (ws.matchedPartner) {
    const partner = ws.matchedPartner;
    
    sendToClient(partner, {
      type: 'partner_left',
      message: '对方已离开'
    });
    
    partner.state = REMOTE_STATE.DISCONNECTED;
    partner.matchedPartner = null;
    
    if (ws.matchId) {
      ACTIVE_MATCHES.delete(ws.matchId);
    }
  }
  
  if (ws.state === REMOTE_STATE.MATCHING) {
    MATCHING_POOL.delete(ws.connectionId);
  }
  
  ws.state = REMOTE_STATE.DISCONNECTED;
  ws.matchedPartner = null;
}

function handleDisconnect(ws) {
  handleLeave(ws);
  
  if (USER_CONNECTIONS.has(ws.userId)) {
    USER_CONNECTIONS.get(ws.userId).delete(ws);
    if (USER_CONNECTIONS.get(ws.userId).size === 0) {
      USER_CONNECTIONS.delete(ws.userId);
    }
  }
  
  MATCHING_POOL.delete(ws.connectionId);
}

function sendToClient(ws, data) {
  if (ws.readyState === 1) {
    ws.send(JSON.stringify(data));
  }
}

function sendError(ws, message) {
  sendToClient(ws, {
    type: 'error',
    text: message
  });
}

class RemoteEngine {
  constructor() {
    this.type = 'remote';
    this.ws = null;
    this.state = REMOTE_STATE.IDLE;
    this.matchedPartner = null;
    this._messageQueue = [];
    this._pendingReply = null;
    this._matchTimeoutId = null;
  }

  async init(config) {
    this.config = config;
    return true;
  }

  isReady(settings) {
    return !!(settings?.remoteUrl && settings.remoteUrl.length > 0);
  }

  async reply(ctx) {
    return new LocalEngine().reply(ctx);
  }

  async advise(ctx) {
    return new LocalEngine().advise(ctx);
  }

  async simulate(scenarioKey, ctx) {
    return new LocalEngine().simulate(scenarioKey, ctx);
  }

  async destroy() {
    return true;
  }
}

function createRemoteEngine() {
  return new RemoteEngine();
}

function getMatchingStats() {
  return {
    matchingPool: MATCHING_POOL.size,
    activeMatches: ACTIVE_MATCHES.size,
    connectedUsers: USER_CONNECTIONS.size
  };
}

module.exports = {
  RemoteEngine,
  createRemoteEngine,
  REMOTE_STATE,
  setupWebSocket,
  getMatchingStats,
  MATCHING_POOL,
  ACTIVE_MATCHES,
  USER_CONNECTIONS
};
