# 恋爱军师 - 产品需求文档 (PRD)

**技术栈:** Node.js

---


**版本**: v2.0  
**日期**: 2026-04-30  
**状态**: 待开发

---

### 1. 项目概述

将现有单文件原型（57KB HTML）扩展为完整的前后端分离系统，支持用户注册、对话历史云端存储、AI 引擎接入、管理后台等企业级功能。

**现有基础**
- 本地规则引擎（8 种人格 × 关系阶段 × 话术库）
- 实战对话 + 模拟对话双模式
- 人设配置（性别/性格/关系阶段）
- localStorage 本地存储

---

### 2. 核心功能模块

### 2.1 用户系统
**优先级**: P0

| 功能点 | 说明 |
|--------|------|
| 注册/登录 | 手机号/邮箱 + 密码，JWT 认证 |
| 角色权限 | 普通用户 / VIP / 管理员三级 |
| 个人中心 | 修改密码、人设管理、对话历史 |
| VIP 权益 | AI 引擎调用次数、高级人格库、优先匹配 |

**权限矩阵**
```
功能              | 普通 | VIP | 管理员
-----------------|------|-----|-------
本地规则引擎      | ✓    | ✓   | ✓
AI 大模型（10次/日）| ✗    | ✓   | ✓
远程匹配          | ✗    | ✓   | ✓
对话历史云存储    | 7天  | 永久 | 永久
自定义人格导入    | ✗    | ✓   | ✓
管理后台          | ✗    | ✗   | ✓
```

---

### 2.2 对话历史云端化
**优先级**: P0

- **存储结构**: MongoDB 按 session 存储完整对话
- **跨设备同步**: 登录后自动拉取历史会话
- **搜索功能**: 按关键词/日期/人设筛选
- **导出功能**: JSON/TXT 格式导出对话记录

**数据模型**
```javascript
Session {
  _id: ObjectId,
  userId: ObjectId,
  myPersonality: String,    // 性格代码
  taPersonality: String,
  stage: String,            // 关系阶段
  engine: String,           // local/ai/remote
  messages: [{
    who: String,            // me/ta
    text: String,
    timestamp: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

---

### 2.3 AI 引擎接入
**优先级**: P1

**支持模型**
- OpenAI (GPT-4o / GPT-4o-mini)
- Anthropic (Claude Sonnet 4)
- DeepSeek (deepseek-chat)
- 自定义 Endpoint（兼容 OpenAI API）

**实现方式**
```javascript
// 后端统一接口
POST /api/chat/reply
{
  "engine": "ai",
  "provider": "openai",
  "model": "gpt-4o",
  "context": {
    "myPersonality": "confident",
    "taPersonality": "shy",
    "stage": "dating",
    "lastMsg": "今天天气真好",
    "history": [...]
  }
}
```

**配额管理**
- 普通用户：禁用
- VIP 用户：10 次/日（可购买额外包）
- 管理员：无限制

---

### 2.4 管理后台
**优先级**: P1

**功能清单**
1. **用户管理**
   - 用户列表（搜索/筛选/封禁）
   - 角色变更（普通 ↔ VIP ↔ 管理员）
   - 使用统计（对话次数/引擎调用）

2. **数据统计**
   - DAU/MAU 趋势图
   - 引擎使用分布（本地/AI/远程）
   - 人格偏好热力图
   - 关系阶段分布

3. **人格库维护**
   - 预设人格 CRUD
   - 话术库编辑
   - 用户自定义人格审核

4. **系统配置**
   - AI 模型配额设置
   - VIP 价格配置
   - 公告/维护通知

---

### 2.5 远程匹配（可选）
**优先级**: P2

- WebSocket 实时匹配在线用户
- 匹配策略：按人格互补/同类型/随机/关系阶段
- 匿名聊天（仅公开人设，隐藏真实身份）
- 虚拟人形象接入（语音/视觉反馈）

---

### 3. 技术架构

### 3.1 技术栈

**后端**
- **框架**: Node.js 18+ + Express 4.x
- **数据库**: MongoDB 6.0+（对话历史/用户数据）
- **认证**: JWT (jsonwebtoken)
- **实时通信**: Socket.io（远程匹配）
- **日志**: Winston
- **进程管理**: PM2

**前端**
- **用户端**: 原生 JS（保持现有风格）
- **管理后台**: Vue 3 + Element Plus
- **图表**: ECharts 5.x

**部署**
- **容器化**: Docker + Docker Compose
- **反向代理**: Nginx
- **HTTPS**: Let's Encrypt
- **监控**: Prometheus + Grafana（可选）

---

### 3.2 目录结构

```
love-strategist/
├── backend/
│   ├── server.js              # Express 主服务
│   ├── config/
│   │   └── default.json       # 配置文件
│   ├── routes/
│   │   ├── auth.js            # 注册/登录/JWT
│   │   ├── users.js           # 用户管理
│   │   ├── chat.js            # 对话历史 CRUD
│   │   ├── admin.js           # 后台管理 API
│   │   └── engine.js          # 引擎调用统一接口
│   ├── models/
│   │   ├── User.js            # 用户表
│   │   ├── Session.js         # 对话会话
│   │   └── Persona.js         # 人格配置
│   ├── middleware/
│   │   ├── auth.js            # JWT 验证
│   │   └── rbac.js            # 角色权限检查
│   ├── engines/
│   │   ├── local.js           # 本地规则引擎（迁移自前端）
│   │   ├── ai.js              # AI 大模型接口
│   │   └── remote.js          # WebSocket 匹配逻辑
│   └── utils/
│       ├── logger.js          # Winston 日志
│       └── quota.js           # 配额管理
├── frontend/
│   ├── user/
│   │   ├── index.html         # 用户端（改造现有文件）
│   │   ├── login.html         # 登录页
│   │   └── profile.html       # 个人中心
│   └── admin/
│       ├── index.html         # 管理后台入口
│       ├── dashboard.html     # 数据统计
│       ├── users.html         # 用户管理
│       └── personas.html      # 人格库维护
├── docker/
│   ├── Dockerfile             # 后端镜像
│   ├── docker-compose.yml     # 编排文件
│   └── nginx.conf             # Nginx 配置
├── scripts/
│   ├── init-db.js             # 数据库初始化
│   └── seed-personas.js       # 预设人格数据
├── .env.example               # 环境变量模板
├── package.json
└── README.md
```

---

### 3.3 API 设计

**认证相关**
```
POST   /api/auth/register      # 注册
POST   /api/auth/login         # 登录
POST   /api/auth/refresh       # 刷新 Token
GET    /api/auth/profile       # 获取当前用户信息
```

**对话相关**
```
POST   /api/chat/reply         # 获取回复（调用引擎）
GET    /api/chat/sessions      # 获取对话列表
GET    /api/chat/sessions/:id  # 获取对话详情
DELETE /api/chat/sessions/:id  # 删除对话
POST   /api/chat/export        # 导出对话记录
```

**用户管理（管理员）**
```
GET    /api/admin/users        # 用户列表
PUT    /api/admin/users/:id    # 修改用户角色/状态
GET    /api/admin/stats        # 数据统计
```

**人格库（管理员）**
```
GET    /api/admin/personas     # 人格列表
POST   /api/admin/personas     # 新增人格
PUT    /api/admin/personas/:id # 修改人格
DELETE /api/admin/personas/:id # 删除人格
```

---

### 3.4 数据库 Schema

**User 表**
```javascript
{
  _id: ObjectId,
  phone: String,              // 手机号（唯一）
  email: String,              // 邮箱（可选）
  password: String,           // bcrypt 加密
  role: String,               // user/vip/admin
  quota: {
    aiDaily: Number,          // AI 引擎每日配额
    aiUsed: Number,           // 今日已用
    resetAt: Date             // 配额重置时间
  },
  createdAt: Date,
  lastLoginAt: Date
}
```

**Session 表**（见 2.2 节）

**Persona 表**
```javascript
{
  _id: ObjectId,
  code: String,               // 性格代码（如 confident）
  name: String,               // 显示名称
  emoji: String,              // 表情符号
  traits: [String],           // 特质标签
  responses: {
    greeting: [String],       // 开场白话术
    flirting: [String],       // 调情话术
    comfort: [String],        // 安慰话术
    // ... 其他场景
  },
  isBuiltin: Boolean,         // 是否预设人格
  createdBy: ObjectId,        // 创建者（自定义人格）
  createdAt: Date
}
```

---

### 4. 部署方案

### 4.1 Docker Compose 编排

```yaml
version: '3.8'
services:
  mongodb:
    image: mongo:6.0
    volumes:
      - mongo-data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}

  backend:
    build: ./docker
    ports:
      - "7856:7856"
    environment:
      NODE_ENV: production
      MONGO_URI: mongodb://admin:${MONGO_PASSWORD}@mongodb:27017/love-strategist
      JWT_SECRET: ${JWT_SECRET}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
    depends_on:
      - mongodb

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx.conf:/etc/nginx/nginx.conf
      - ./frontend:/usr/share/nginx/html
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - backend

volumes:
  mongo-data:
```

---

### 4.2 环境变量（.env）

```bash
# 数据库
MONGO_PASSWORD=your_mongo_password
MONGO_URI=mongodb://admin:your_mongo_password@localhost:27017/love-strategist

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRES_IN=7d

# AI 引擎
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
DEEPSEEK_API_KEY=sk-...

# 服务端口
PORT=7856

# 管理员初始账号
ADMIN_PHONE=13800138000
ADMIN_PASSWORD=admin123456
```

---

### 5. 开发计划

### Phase 1: 基础架构（2 周）
- [ ] 后端框架搭建（Express + MongoDB）
- [ ] 用户注册/登录/JWT 认证
- [ ] 前端登录页 + 个人中心
- [ ] 对话历史云端存储

### Phase 2: 引擎迁移（1 周）
- [ ] 本地规则引擎迁移到后端
- [ ] AI 引擎接口封装（OpenAI/Claude/DeepSeek）
- [ ] 配额管理系统

### Phase 3: 管理后台（1.5 周）
- [ ] 用户管理界面
- [ ] 数据统计看板（ECharts）
- [ ] 人格库维护界面

### Phase 4: 远程匹配（可选，2 周）
- [ ] WebSocket 匹配服务
- [ ] 匿名聊天逻辑
- [ ] 虚拟人形象接入

### Phase 5: 部署上线（1 周）
- [ ] Docker 镜像构建
- [ ] Nginx 反向代理配置
- [ ] HTTPS 证书配置
- [ ] 监控告警（可选）

---

### 6. 非功能需求

### 6.1 性能指标
- API 响应时间 < 200ms（P95）
- AI 引擎调用超时 30s
- 支持 1000 并发用户

### 6.2 安全要求
- 密码 bcrypt 加密（salt rounds = 10）
- JWT Token 7 天过期
- API 限流：100 req/min/IP
- SQL 注入防护（使用 Mongoose）
- XSS 防护（前端输入转义）

### 6.3 可维护性
- 日志分级（info/warn/error）
- 错误码统一（1xxx 用户错误 / 2xxx 系统错误）
- API 文档（Swagger/Postman）

---

### 7. 风险与依赖

| 风险项 | 影响 | 缓解措施 |
|--------|------|----------|
| AI 模型 API 不稳定 | 用户体验下降 | 降级到本地规则引擎 |
| MongoDB 数据丢失 | 对话历史丢失 | 每日自动备份 |
| 并发量超预期 | 服务崩溃 | 水平扩展 + 负载均衡 |
| 第三方 API 费用超支 | 成本失控 | 配额硬限制 + 预警 |

---

### 8. 后续迭代方向

- 微信小程序版本
- 语音对话（TTS/STT）
- 情感分析可视化
- 社交功能（匿名树洞/经验分享）
- 付费订阅体系（月卡/年卡）

