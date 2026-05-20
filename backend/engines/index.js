const { LocalEngine, createLocalEngine } = require('./local');
const { AIEngine, createAIEngine } = require('./ai');
const { RemoteEngine, createRemoteEngine } = require('./remote');

const ENGINES = {
  local: LocalEngine,
  ai: AIEngine,
  remote: RemoteEngine
};

function createEngine(type) {
  switch (type) {
    case 'ai':
      return createAIEngine();
    case 'remote':
      return createRemoteEngine();
    case 'local':
    default:
      return createLocalEngine();
  }
}

function getEngineClass(type) {
  return ENGINES[type] || ENGINES.local;
}

async function generateReply(engineType, ctx, settings = null) {
  const engine = createEngine(engineType);
  
  try {
    await engine.init(ctx);
    
    if (engineType === 'ai' && settings) {
      return await engine.reply(ctx, settings);
    }
    
    return await engine.reply(ctx);
  } finally {
    await engine.destroy();
  }
}

async function generateAdvice(engineType, ctx, settings = null) {
  const engine = createEngine(engineType);
  
  try {
    await engine.init(ctx);
    
    if (engineType === 'ai' && settings) {
      return await engine.advise(ctx, settings);
    }
    
    return await engine.advise(ctx);
  } finally {
    await engine.destroy();
  }
}

async function generateSimulation(engineType, scenarioKey, ctx, settings = null) {
  const engine = createEngine(engineType);
  
  try {
    await engine.init(ctx);
    
    if (engineType === 'ai' && settings) {
      return await engine.simulate(scenarioKey, ctx, settings);
    }
    
    return await engine.simulate(scenarioKey, ctx);
  } finally {
    await engine.destroy();
  }
}

module.exports = {
  createEngine,
  getEngineClass,
  generateReply,
  generateAdvice,
  generateSimulation,
  ENGINES,
  LocalEngine,
  AIEngine,
  RemoteEngine
};
