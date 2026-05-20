require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const engineRoutes = require('./routes/engine');
const userRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');
const { initDB } = require('./models');
const { loadPermissions } = require('./middleware/rbac');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const FRONTEND_USER = path.join(__dirname, '..', 'frontend', 'user');
const FRONTEND_ADMIN = path.join(__dirname, '..', 'frontend', 'admin');

app.use('/static/user', express.static(FRONTEND_USER));
app.use('/static/admin', express.static(FRONTEND_ADMIN));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: '请求过于频繁，请稍后再试' }
});
app.use('/api', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/engine', engineRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_USER, 'index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(FRONTEND_ADMIN, 'index.html'));
});

app.get('/chat', (req, res) => {
  res.sendFile(path.join(FRONTEND_USER, 'index.html'));
});

async function start() {
  try {
    await initDB();
    console.log('数据库初始化完成');
    
    await loadPermissions();
    
    const server = app.listen(PORT, () => {
      console.log(`🚀 恋爱军师后端服务已启动: http://localhost:${PORT}`);
      console.log(`📖 API 文档: http://localhost:${PORT}/api/health`);
    });

    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ server, path: '/ws/match' });
    require('./engines/remote').setupWebSocket(wss);
    console.log('🔌 WebSocket 匹配服务已启动');
    
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
}

start();
