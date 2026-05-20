const { getPersonality, classify, pick, STAGES, SCENARIOS, CONFESS, CONFESS_R, DATE_INV, DATE_R, genderName } = require('../models/personality');

const ANALYSIS_MAP = {
  hi: 'TA回复了打招呼，对话通道已开。回复越长越详细=越有兴趣。',
  praise: 'TA对赞美有回应。害羞或反夸=好信号；敷衍=还不够熟。',
  care: 'TA关心你了！行动比甜言蜜语更真实。',
  flirt: '暧昧时刻！注意是主动推进还是被动接受。',
  sad: 'TA展示脆弱面=信任。好好接住。',
  happy: 'TA分享快乐=你在TA的分享列表里。',
  chat: '日常聊天。注意是简短应付还是主动延展。',
  ask: 'TA在提问=对你有好奇心。展示有趣的一面。',
  argue: '有分歧。别慌，认真对话反而说明在意。',
  bye: '话题要结束。恋恋不舍=想继续聊。'
};

class LocalEngine {
  constructor() {
    this.type = 'local';
    this.config = null;
  }

  async init(config) {
    this.config = config;
    return true;
  }

  async reply(ctx) {
    const personality = await getPersonality(ctx.taPersonality);
    if (!personality) {
      return { text: '你好呀～', msgType: 'hi' };
    }

    const msgType = classify(ctx.lastMsg);
    const responses = personality.r[msgType] || personality.r.chat || [];
    const text = pick(responses) || '你好呀～';

    return {
      text,
      msgType: classify(text),
      engine: 'local'
    };
  }

  async simulate(scenarioKey, ctx) {
    const scenario = SCENARIOS[scenarioKey];
    if (!scenario) return [];

    const myPersonality = await getPersonality(ctx.myPersonality);
    const taPersonality = await getPersonality(ctx.taPersonality);

    if (!myPersonality || !taPersonality) return [];

    const turns = [];

    for (let i = 0; i < scenario.length; i++) {
      const turn = scenario[i];
      const isMe = turn.w === 'me';
      const pers = isMe ? myPersonality : taPersonality;

      let msg;

      if (scenarioKey === 'confess' && i === 6) {
        msg = CONFESS[ctx.myPersonality] || pick(pers.r.flirt || pers.r.chat);
      } else if (scenarioKey === 'confess' && i === 7) {
        msg = CONFESS_R[ctx.taPersonality] || pick(pers.r.flirt || pers.r.chat);
      } else if (scenarioKey === 'date' && i === 6) {
        msg = DATE_INV[ctx.myPersonality] || pick(pers.r.flirt || pers.r.chat);
      } else if (scenarioKey === 'date' && i === 7) {
        msg = DATE_R[ctx.taPersonality] || pick(pers.r.happy || pers.r.chat);
      } else {
        const pool = pers.r[turn.t] || pers.r.chat || [];
        msg = pick(pool) || '嗯...';
      }

      turns.push({
        who: turn.w,
        text: msg,
        comment: turn.c
      });
    }

    return turns;
  }

  async advise(ctx) {
    const personality = await getPersonality(ctx.taPersonality);
    if (!personality) {
      return {
        analysis: '分析中...',
        suggestions: ['继续聊下去'],
        warning: ''
      };
    }

    const msgType = ctx.msgType || 'chat';
    const baseAnalysis = ANALYSIS_MAP[msgType] || ANALYSIS_MAP.chat;
    const tip = personality.tip || {};

    const suggestions = personality.sug || {};
    const suggList = suggestions[msgType] || suggestions._ || [];

    return {
      analysis: baseAnalysis + '\n\n💡 ' + (tip.k || '真诚是最好的策略'),
      suggestions: suggList.length > 0 ? suggList : ['保持自然，做自己'],
      warning: personality.warn || '',
      engine: 'local'
    };
  }

  getOpening(personalityKey) {
    return getPersonality(personalityKey).then(p => {
      if (!p) return '你好呀～';
      return pick(p.open || ['你好呀～']);
    });
  }

  isReady() {
    return true;
  }

  async destroy() {
    this.config = null;
    return true;
  }
}

function createLocalEngine() {
  return new LocalEngine();
}

module.exports = {
  LocalEngine,
  createLocalEngine,
  ANALYSIS_MAP
};
