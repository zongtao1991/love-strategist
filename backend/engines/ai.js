const fetch = require('node-fetch');
const { getPersonality, classify, pick, STAGES, genderName } = require('../models/personality');
const { LocalEngine } = require('./local');

const PROVIDER_CONFIGS = {
  openai: {
    name: 'OpenAI',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-4-turbo', 'gpt-4'],
    defaultModel: 'gpt-4o-mini',
    authType: 'bearer',
    isAnthropic: false
  },
  anthropic: {
    name: 'Anthropic (Claude)',
    endpoint: 'https://api.anthropic.com/v1/messages',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-haiku-4-20250514', 'claude-3-5-sonnet-20241022'],
    defaultModel: 'claude-sonnet-4-20250514',
    authType: 'x-api-key',
    isAnthropic: true
  },
  deepseek: {
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
    authType: 'bearer',
    isAnthropic: false
  },
  qwen: {
    name: '阿里通义千问',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max', 'qwen-long', 'qwen-omni-turbo'],
    defaultModel: 'qwen-turbo',
    authType: 'bearer',
    isAnthropic: false
  },
  doubao: {
    name: '字节豆包',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    models: ['Doubao-seed-1.8k', 'Doubao-lite-32k', 'Doubao-pro-32k', 'Doubao-pro-128k'],
    defaultModel: 'Doubao-seed-1.8k',
    authType: 'bearer',
    isAnthropic: false
  },
  wenxin: {
    name: '百度文心一言',
    endpoint: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions',
    models: ['ernie-4.0-8k', 'ernie-3.5-8k', 'ernie-speed-128k', 'ernie-tiny-8k'],
    defaultModel: 'ernie-4.0-8k',
    authType: 'bearer',
    isAnthropic: false,
    note: '需要通过 API Key 获取 Access Token，或使用兼容模式'
  },
  glm: {
    name: '智谱清言',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    models: ['glm-4', 'glm-4-flash', 'glm-4-plus', 'glm-3-turbo', 'glm-4-0520'],
    defaultModel: 'glm-4-flash',
    authType: 'bearer',
    isAnthropic: false
  },
  moonshot: {
    name: '月之暗面 Moonshot',
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    defaultModel: 'moonshot-v1-8k',
    authType: 'bearer',
    isAnthropic: false
  },
  yi: {
    name: '零一万物 Yi',
    endpoint: 'https://api.lingyiwanwu.com/v1/chat/completions',
    models: ['yi-34b-chat', 'yi-large', 'yi-medium', 'yi-spark'],
    defaultModel: 'yi-34b-chat',
    authType: 'bearer',
    isAnthropic: false
  },
  hunyuan: {
    name: '腾讯混元',
    endpoint: 'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
    models: ['hunyuan-lite', 'hunyuan-standard', 'hunyuan-pro', 'hunyuan-code'],
    defaultModel: 'hunyuan-lite',
    authType: 'bearer',
    isAnthropic: false
  },
  stepfun: {
    name: '阶跃星辰 StepFun',
    endpoint: 'https://api.stepfun.com/v1/chat/completions',
    models: ['step-1-8k', 'step-1-32k', 'step-1-128k', 'step-1-flash'],
    defaultModel: 'step-1-8k',
    authType: 'bearer',
    isAnthropic: false
  },
  minimax: {
    name: 'MiniMax',
    endpoint: 'https://api.minimax.chat/v1/text/chatcompletion_v2',
    models: ['abab6.5s-chat', 'abab6.5t-chat', 'abab5.5-chat', 'abab5.5s-chat'],
    defaultModel: 'abab6.5s-chat',
    authType: 'bearer',
    isAnthropic: false
  },
  custom: {
    name: '自定义 Endpoint',
    endpoint: '',
    models: [],
    defaultModel: 'gpt-4o-mini',
    authType: 'bearer',
    isAnthropic: false
  }
};

const STYLE_PROMPTS = {
  default: '',
  cute: '语言风格要可爱、萌，多用语气词（比如"呀、呢、喵、呜"），偶尔用表情符号。',
  mature: '语言风格要成熟稳重，用词严谨，给人可靠的感觉。',
  humor: '语言风格要幽默风趣，适当玩梗，让对话轻松愉快。',
  poetic: '语言风格要文艺浪漫，用词优美，带有诗意。',
  dominant: '语言风格要强势自信，带点霸道总裁范，说话有决断力。'
};

class AIEngine {
  constructor() {
    this.type = 'ai';
    this.config = null;
    this._timeout = 30000;
  }

  async init(config) {
    this.config = config;
    return true;
  }

  isReady(settings) {
    if (!settings) return false;
    return !!(settings.aiKey && settings.aiKey.length > 5);
  }

  _getProviderConfig(settings) {
    const provider = settings.aiProvider || 'openai';
    const config = PROVIDER_CONFIGS[provider] || PROVIDER_CONFIGS.openai;
    
    if (settings.aiEndpoint && settings.aiEndpoint.length > 0) {
      return { ...config, endpoint: settings.aiEndpoint };
    }
    
    return config;
  }

  _getModel(settings) {
    if (settings.aiModel && settings.aiModel.length > 0) {
      return settings.aiModel;
    }
    
    const providerConfig = this._getProviderConfig(settings);
    return providerConfig.defaultModel;
  }

  _buildSystemPrompt(ctx, settings) {
    const taPersonality = ctx.taPersonalityData || { n: '神秘人', d: '' };
    const myPersonality = ctx.myPersonalityData || { n: '未知', d: '' };
    const stage = STAGES.find(s => s.k === ctx.stage)?.n || '';
    
    const taGenderText = ctx.taGender === 's' ? '未公开（你可以根据对话自然表现）' : genderName(ctx.taGender);
    const myGenderText = ctx.myGender === 's' ? '未公开' : genderName(ctx.myGender);
    const stylePmt = STYLE_PROMPTS[settings.aiStyle] || '';
    
    let basePmt = `你是一个恋爱角色扮演AI。你要扮演以下角色回复：
角色性格：${taPersonality.name || taPersonality.n}（${taPersonality.description || taPersonality.d}）
角色性别：${taGenderText}
对方性格：${myPersonality.name || myPersonality.n}（${myPersonality.description || myPersonality.d}）
对方性别：${myGenderText}
关系阶段：${stage}

核心要求：
1. 完全代入角色，用第一人称回复
2. 回复简短自然，像真人微信聊天（1-3句话）
3. 符合角色性格特征
4. 不要加任何旁白/标注/角色名前缀
5. 如果性别未公开，不要刻意提及性别，自然对话即可

${stylePmt}

${settings.aiSysPrompt ? '\n用户补充指令：' + settings.aiSysPrompt : ''}`;

    return basePmt;
  }

  _buildAdvisorPrompt(ctx) {
    const taPersonality = ctx.taPersonalityData || { n: '神秘人', d: '' };
    const stage = STAGES.find(s => s.k === ctx.stage)?.n || '';
    
    return `你是专业的恋爱军师，根据对话内容分析局势并给出实用建议。
对方性格：${taPersonality.name || taPersonality.n}（${taPersonality.description || taPersonality.d}）
关系阶段：${stage}

请严格用JSON格式返回，不要任何其他内容：
{"analysis":"局势分析（2-3句，要具体）","suggestions":["推荐回复1","推荐回复2","推荐回复3"],"warning":"避雷提示（1-2句，如果没有则为空字符串）"}`;
  }

  async _callAPI(messages, settings) {
    const providerConfig = this._getProviderConfig(settings);
    const model = this._getModel(settings);
    const temperature = settings.aiTemperature !== undefined ? settings.aiTemperature : 0.8;
    const timeout = (settings.aiTimeout || 30) * 1000;
    const useFallback = settings.aiUseFallback !== false;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      if (providerConfig.isAnthropic) {
        return await this._callAnthropicAPI(messages, settings, providerConfig, model, temperature, controller, timeoutId);
      }

      return await this._callOpenAICompatibleAPI(messages, settings, providerConfig, model, temperature, controller, timeoutId);
    } catch (e) {
      clearTimeout(timeoutId);
      if (useFallback) {
        console.warn('AI API调用失败，降级到本地规则引擎:', e.message);
        return null;
      }
      throw e;
    }
  }

  async _callAnthropicAPI(messages, settings, providerConfig, model, temperature, controller, timeoutId) {
    const sys = messages.find(m => m.role === 'system')?.content || '';
    const msgs = messages.filter(m => m.role !== 'system');

    const resp = await fetch(providerConfig.endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': settings.aiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: sys,
        messages: msgs,
        temperature
      })
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`API错误: ${resp.status} ${errText}`);
    }

    const data = await resp.json();
    return data.content?.[0]?.text || '';
  }

  async _callOpenAICompatibleAPI(messages, settings, providerConfig, model, temperature, controller, timeoutId) {
    let headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + settings.aiKey
    };

    const body = {
      model,
      messages,
      max_tokens: 800,
      temperature
    };

    const resp = await fetch(providerConfig.endpoint, {
      method: 'POST',
      signal: controller.signal,
      headers,
      body: JSON.stringify(body)
    });

    clearTimeout(timeoutId);

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`API错误: ${resp.status} ${errText}`);
    }

    const data = await resp.json();
    return data.choices?.[0]?.message?.content || data.result || '';
  }

  async reply(ctx, settings) {
    if (!this.isReady(settings)) {
      console.log('AI引擎未就绪，使用本地规则引擎');
      return new LocalEngine().reply(ctx);
    }

    try {
      const myPersonalityData = await getPersonality(ctx.myPersonality);
      const taPersonalityData = await getPersonality(ctx.taPersonality);
      
      const enrichedCtx = {
        ...ctx,
        myPersonalityData,
        taPersonalityData
      };

      const sysPmt = this._buildSystemPrompt(enrichedCtx, settings);
      const messages = [{ role: 'system', content: sysPmt }];

      (ctx.history || []).slice(-10).forEach(h => {
        messages.push({
          role: h.who === 'me' ? 'user' : 'assistant',
          content: h.text
        });
      });

      messages.push({ role: 'user', content: ctx.lastMsg });

      const text = await this._callAPI(messages, settings);
      
      if (text === null) {
        return new LocalEngine().reply(ctx);
      }

      return {
        text: text.trim(),
        msgType: classify(text.trim()),
        engine: 'ai'
      };
    } catch (e) {
      console.error('AI引擎调用失败:', e);
      return new LocalEngine().reply(ctx);
    }
  }

  async advise(ctx, settings) {
    if (!this.isReady(settings)) {
      return new LocalEngine().advise(ctx);
    }

    try {
      const taPersonalityData = await getPersonality(ctx.taPersonality);
      const enrichedCtx = { ...ctx, taPersonalityData };

      const advPmt = this._buildAdvisorPrompt(enrichedCtx);
      const messages = [
        { role: 'system', content: advPmt },
        {
          role: 'user',
          content: `对方最新回复："${ctx.lastTaMsg}"\n最近对话：${JSON.stringify((ctx.history || []).slice(-6).map(h => h.who + ':' + h.text))}`
        }
      ];

      const raw = await this._callAPI(messages, settings);
      
      if (raw === null) {
        return new LocalEngine().advise(ctx);
      }

      const json = JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, ''));
      return {
        analysis: json.analysis || '',
        suggestions: json.suggestions || [],
        warning: json.warning || '',
        engine: 'ai'
      };
    } catch (e) {
      console.error('AI军师调用失败:', e);
      return new LocalEngine().advise(ctx);
    }
  }

  async simulate(scenarioKey, ctx, settings) {
    if (!this.isReady(settings)) {
      return new LocalEngine().simulate(scenarioKey, ctx);
    }

    try {
      const myPersonalityData = await getPersonality(ctx.myPersonality);
      const taPersonalityData = await getPersonality(ctx.taPersonality);
      const stage = STAGES.find(s => s.k === ctx.stage)?.n || '';
      
      const myGenderText = ctx.myGender === 's' ? '未公开' : genderName(ctx.myGender);
      const taGenderText = ctx.taGender === 's' ? '未公开' : genderName(ctx.taGender);

      const prompt = `生成一段10轮恋爱对话，场景：${scenarioKey}
A：性别${myGenderText}，性格${myPersonalityData?.name || '未知'}
B：性别${taGenderText}，性格${taPersonalityData?.name || '未知'}
关系阶段：${stage}

要求JSON数组格式：[{"who":"me"或"ta","text":"对话内容","comment":"军师点评（15字以内）"},...]
只输出JSON，不要其他内容。如果性别未公开，不要刻意提及性别，自然对话即可。`;

      const raw = await this._callAPI([{ role: 'user', content: prompt }], settings);
      
      if (raw === null) {
        return new LocalEngine().simulate(scenarioKey, ctx);
      }

      return JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, ''));
    } catch (e) {
      console.error('AI模拟调用失败:', e);
      return new LocalEngine().simulate(scenarioKey, ctx);
    }
  }

  async destroy() {
    this.config = null;
    return true;
  }

  static getSupportedProviders() {
    return Object.entries(PROVIDER_CONFIGS)
      .filter(([key]) => key !== 'custom')
      .map(([key, config]) => ({
        key,
        name: config.name,
        models: config.models,
        defaultModel: config.defaultModel
      }));
  }
}

function createAIEngine() {
  return new AIEngine();
}

module.exports = {
  AIEngine,
  createAIEngine,
  PROVIDER_CONFIGS,
  STYLE_PROMPTS
};
