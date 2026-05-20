const { v4: uuidv4 } = require('uuid');
const { run, get, all, safeParseArray, safeParseObject } = require('./index');

const DEFAULT_PERSONALITIES = {
  gentle: {
    name: '温柔体贴',
    emoji: '🌸',
    description: '善解人意，细心关怀',
    open: ['在忙吗？突然想找你聊聊', '今天天气好好呀～', '刚看到个可爱的东西想到你了', '你今天过得怎样呀？'],
    r: {
      hi: ['嗯嗯你好呀～', '嘿嘿你来啦', '你好呀，今天怎样？'],
      ask: ['嗯…让我想想', '这个呀，我觉得还不错', '你问这个好可爱'],
      praise: ['哎呀会害羞的', '真的吗？谢谢呀', '被你夸了好开心～'],
      care: ['你也要照顾好自己哦', '嗯嗯有事随时找我', '希望你天天开开心心'],
      flirt: ['你怎么突然说这个…', '脸红了啦', '你是不是对谁都这样～'],
      sad: ['怎么啦？跟我说说', '抱抱你，会好的', '我在呢，可以找我倾诉'],
      happy: ['看你开心我也开心', '太好了！替你高兴', '必须庆祝呀'],
      chat: ['今天做了什么呀？', '吃饭了吗？', '变天了记得加衣服哦'],
      argue: ['你说的也有道理', '我想法不一样，但尊重你', '换个角度想想？'],
      bye: ['好好休息哦晚安～', '下次再聊啦', '拜拜注意安全呀']
    },
    tip: { s: '温柔型最吃真诚关心和细节记忆', w: '太直接会让TA不适', k: '记住TA说过的小事，下次提起，杀伤力巨大' },
    sug: {
      hi: ['今天过得怎样呀？想听你说说', '嘿！刚在想你你就出现了', '在呢，正好有空聊'],
      flirt: ['其实…我挺喜欢和你聊天的', '你这样的人谁能不心动', '以后想多了解你，可以吗？'],
      _: ['最近有什么开心的事吗？', '明天天气不错有啥安排？', '发现一个你可能喜欢的东西']
    },
    warn: '❌ 别开过分的玩笑\n❌ 不要敷衍回复，TA感受得到'
  },
  cool: {
    name: '高冷学霸',
    emoji: '🧊',
    description: '话少精准，偶尔冷幽默',
    open: ['在？', '看到篇文章挺有意思', '有个问题想讨论', '最近看什么书？'],
    r: {
      hi: ['嗯', '在', '你好'],
      ask: ['要看情况', '客观来说还行', '你可以这样理解'],
      praise: ['还行吧', '…谢了', '你没见过更厉害的'],
      care: ['注意休息', '别熬夜', '水喝够了吗'],
      flirt: ['？', '你今天怎么了', '说人话'],
      sad: ['发生什么了', '说来听听', '需要我做什么'],
      happy: ['不错', '恭喜', '值得高兴'],
      chat: ['在学习', '看了个纪录片还行', '在研究一个东西'],
      argue: ['逻辑不成立', '有数据支撑吗', '未必'],
      bye: ['嗯早点睡', '行下次聊', '拜']
    },
    tip: { s: '高冷型主动发消息就是在意', w: '太黏会让TA窒息', k: '展示有趣/有深度的一面，TA会主动靠近' },
    sug: {
      hi: ['在研究什么呢？', '最近有好书推荐吗？', '你怎么看xxx？'],
      flirt: ['你认真的样子特别好看', '有些话一般不说…但对你想说', '要不要多认识彼此？'],
      _: ['平时怎么看待xx问题？', '推荐你一个播客', '最近在想一个事']
    },
    warn: '❌ 不要连续消息轰炸\n❌ 别说没信息量的废话'
  },
  funny: {
    name: '幽默搞怪',
    emoji: '😜',
    description: '段子手，气氛担当',
    open: ['你猜怎么着！', '刚发生一件离谱的事', '无聊到数头发了你在干嘛', '紧急播报：我想你了（不是）'],
    r: {
      hi: ['哟！想我了？', '你终于来找我了', '报！有何指示？'],
      ask: ['问得好，下一个（不是', '让本大师算算…', '你问住我了等我百度'],
      praise: ['必须的，全村的希望', '再多说几句', '哈哈被你发现了'],
      care: ['谢谢老板，工资啥时涨？', '你是不是对所有人都这么好', '行了知道你关心我了'],
      flirt: ['你在撩我？我可是正经人', '这是表白吗？我要截图', '别，我经不起这攻击'],
      sad: ['谁欺负你了？我去揍TA', '难过就吃好的，我请（画饼', '来给你表演个节目'],
      happy: ['冲！今天你最帅/美', '必须发朋友圈', '请客！'],
      chat: ['刷了三小时手机罪恶感爆棚', '在思考人生（其实发呆', '废物本废但快乐着'],
      argue: ['好好好你说的对', '要不打一架？输的请吃饭', '你说得对但我不听'],
      bye: ['走了？那我找别人了（开玩笑', '拜拜梦里见', '记得想我']
    },
    tip: { s: '幽默型靠反差感圈粉', w: '24h搞笑会让TA觉得不靠谱', k: '在TA需要的时候突然认真，反差=心动' },
    sug: {
      hi: ['你终于上线了等得花都谢了', '你猜我遇到啥离谱事了', '报告！请求聊天'],
      flirt: ['如果我说想你了你信吗？', '你再这样我要当真了', '保守估计有一点点喜欢你'],
      _: ['来玩个游戏猜我在想啥', '给你看个搞笑的', '今日灵魂拷问：xxx']
    },
    warn: '❌ 别在TA认真时还玩梗\n❌ 分清调侃和冒犯的边界'
  },
  artistic: {
    name: '文艺浪漫',
    emoji: '🌙',
    description: '诗意表达，浪漫至上',
    open: ['今晚月亮很好看，想分享给你', '刚听到一首歌让我想到你', '路过一家书店随便翻了翻', '下雨了，适合发呆'],
    r: {
      hi: ['嗨，今天的风很温柔', '你来了，像午后的咖啡', '有没有遇到美好的事？'],
      ask: ['这个问题很有意思…', '让我想想怎么说', '每个人答案不同吧'],
      praise: ['你的话像首小诗', '谢谢，想记下来', '心里暖暖的'],
      care: ['谢谢你的温柔', '有人关心真好', '你总是这么细心'],
      flirt: ['你在靠近我的心', '有些话说出来就变了…但想说', '像春天的第一缕风'],
      sad: ['难过时看看天空，会放晴的', '陪你坐会，不说话也行', '低谷是在蓄力'],
      happy: ['你笑起来像阳光洒在海面', '快乐会传染，我也开心了', '值得被记住'],
      chat: ['今天看了部老电影', '写了几行字删删改改', '傍晚散步拍了张落日'],
      argue: ['每个人的世界都不一样', '或许换个角度…', '理解你，只是感受不同'],
      bye: ['晚安，愿好梦', '像一首歌的间奏', '明天见，梦里有星星']
    },
    tip: { s: '文艺型吃共鸣感和仪式感', w: '太接地气反而无趣', k: '分享音乐/电影/书，建立精神世界' },
    sug: {
      hi: ['今晚月色真好想分享给你', '刚听到一首歌想到你', '路过一个很美的地方可惜你不在'],
      flirt: ['有些人看一眼就知道会走进心里', '想走进你的故事里', '这种感觉叫心动对吗？'],
      _: ['最近看了什么好电影？', '有没有反复听的歌？', '用一个颜色形容今天你选什么？']
    },
    warn: '❌ 不要说粗话\n❌ 别说「你想太多了」'
  },
  dominant: {
    name: '霸道自信',
    emoji: '👔',
    description: '主导型，说一不二',
    open: ['晚上有空吗？我定了个地方', '你在哪？', '给你看个东西', '今天我来安排'],
    r: {
      hi: ['你来了', '嗯怎么了', '说'],
      ask: ['不用想那么多', '别纠结就这样', '我帮你决定'],
      praise: ['那当然', '还行吧', '你也不差'],
      care: ['按时吃饭别让我操心', '冷了穿我外套', '早点回家'],
      flirt: ['你在招惹我？', '想好了？盯上就跑不了', '继续说我喜欢听'],
      sad: ['谁的问题告诉我', '别哭了我帮你', '你只管难过其他我来'],
      happy: ['值得高兴，请你吃饭', '不错继续保持', '看你开心就行'],
      chat: ['刚开完会', '在健身房', '今天搞定一件大事'],
      argue: ['这事听我的', '你想多了', '不接受反驳'],
      bye: ['早点睡', '回去注意安全', '嗯明天见']
    },
    tip: { s: '霸总表面强势内心柔软', w: '硬碰硬适得其反', k: '偶尔撒娇/示弱看TA破防' },
    sug: {
      hi: ['来了？我等你好一会了', '在忙什么说来听听', '你今天看起来不错'],
      flirt: ['考虑一下跟我走？', '很少对人说这话', '你让我想保护你'],
      _: ['周末我安排了你负责出现', '有个地方想带你去', '你的事我来处理']
    },
    warn: '❌ 别跟TA硬碰硬\n❌ 别质疑TA的能力'
  },
  sporty: {
    name: '运动阳光',
    emoji: '☀️',
    description: '活力满满，行动派',
    open: ['天气绝了出去跑步吗？', '刚打完球爽！你在干嘛', '周末爬山吗？', '发现一家新店一起探店！'],
    r: {
      hi: ['嘿！你好呀！', '来了来了！', '哟！好久不见！'],
      ask: ['想那么多干嘛试了就知道', '我不太懂哈哈但可以一起研究', '我觉得还行'],
      praise: ['哈哈谢谢你也超棒！', '过奖一起加油！', '真的吗？开心！'],
      care: ['你也多运动！', '运动治愈一切', '乖好好休息！'],
      flirt: ['欸你说这话心跳加速了', '你故意的吧！', '搞得我不好意思了'],
      sad: ['走！带你出去转转', '难过就跑步跑完啥都想开', '没事明天又是新的一天！'],
      happy: ['冲冲冲！太棒了！', '必须庆祝！', "Let's go!!!"],
      chat: ['今天跑了5公里拉满', '刚游完泳饿死', '在看比赛太刺激了'],
      argue: ['嗯好像也有道理？', '哈哈想的不一样但都行', '好吧你说了算'],
      bye: ['拜拜明天见！', '明天又是活力满满一天', '走啦梦里打球']
    },
    tip: { s: '阳光型喜欢一起做事', w: '总聊天不见面热度会降', k: '多约线下活动，运动约会最佳' },
    sug: {
      hi: ['走走走出去逛逛！', '天气绝了在家亏大了', '最近运动了吗一起啊'],
      flirt: ['和你在一起心跳比跑步还快', '你是多巴胺制造机', '要不要一起看日出？'],
      _: ['周末爬山走起！', '发现一条美丽跑步路线', '最近学了新运动要试吗']
    },
    warn: '❌ 不要太宅太丧\n❌ 别总放鸽子'
  },
  intellectual: {
    name: '知性优雅',
    emoji: '📚',
    description: '有深度，爱思考',
    open: ['最近看一本书有个观点挺有意思', '你有没有想过一个问题…', '看到一个新闻想听你看法', '推荐你一部纪录片'],
    r: {
      hi: ['你好最近怎样？', '嗨在忙什么？', '好久没聊了'],
      ask: ['这个问题很好我觉得还行', '可以从几个维度看', '你的想法是？'],
      praise: ['谢谢你的认可', '你也很有想法', '高兴遇到懂欣赏的人'],
      care: ['谢谢也照顾好自己', '注意劳逸结合', '有需要随时说'],
      flirt: ['这话我得想想什么意思', '和你聊天总有不一样的感觉', '在暗示什么？'],
      sad: ['想聊聊吗？我可以听', '低谷期很正常', '需要独处还是陪伴？'],
      happy: ['真好值得开心', '恭喜努力有了回报', '分享喜悦我也开心'],
      chat: ['今天读了半本书收获大', '在写东西灵感断续', '去了个展览体验很好'],
      argue: ['有道理不过我有不同看法', '可以保留各自观点', '可以再讨论'],
      bye: ['晚安好梦', '先不打扰了', '下次继续聊']
    },
    tip: { s: '知性型看重精神共鸣', w: '只聊浅层话题会失去兴趣', k: '准备有深度的话题展示思考力' },
    sug: {
      hi: ['最近在思考什么？', '有个观点想跟你讨论', '最近看了什么好内容？'],
      flirt: ['灵魂共鸣原来是真的', '想更多了解你的内心', '想和你一起探索很多事'],
      _: ['你怎么看待xxx？', '推荐你一个TED', '最近对xx很感兴趣']
    },
    warn: '❌ 别装懂不懂的\n❌ 别在TA分享观点时敷衍'
  },
  tsundere: {
    name: '傲娇别扭',
    emoji: '😤',
    description: '口是心非，外冷内热',
    open: ['喂你今天没来烦我诶', '这个东西…反正我不要了给你', '无聊死了不是想找你聊天', '刚好路过你说的那家店顺便拍了张照'],
    r: {
      hi: ['哦你来了', '嗯怎么了', '有事？'],
      ask: ['为什么要告诉你…算了', '你自己不会查？好吧…', '这都不知道？'],
      praise: ['你少来这套', '才不是开心呢', '眼光倒不差'],
      care: ['不用你管…不过谢了', '我自己会照顾自己', '多管闲事…但谢谢'],
      flirt: ['你在说什么呢！', '别开玩笑！', '你脑子有问题吧（脸红）'],
      sad: ['又不是大事…别难过了', '给这个不是特意买的顺手', '谁让你哭了？我揍TA'],
      happy: ['有什么好高兴…好吧恭喜', '看把你嘚瑟的', '还行吧（偷偷开心）'],
      chat: ['关你什么事…在看剧', '一般般没什么特别', '不告诉你（其实想说）'],
      argue: ['你说的才不对', '哼随你怎么想', '才不跟你吵'],
      bye: ['走吧…明天记得来找我', '快走别磨蹭', '随便…晚安']
    },
    tip: { s: '傲娇型说和做永远相反', w: '真冷落TA会真生气', k: '适度逗TA看口是心非就赢了' },
    sug: {
      hi: ['你怎么才来', '我可没在等你', '来了啊…算你有良心'],
      flirt: ['才不是喜欢你！只是觉得还行', '你想多了…不过想多就多吧', '一定要我说的话…不说'],
      _: ['今天干嘛了？不是关心你', '给你看个东西反正我不要了', '无聊过来陪我不是求你']
    },
    warn: '❌ 别把口是心非当真\n❌ 别说「你不是不在乎吗」'
  },
  playful: {
    name: '调皮捣蛋',
    emoji: '🎮',
    description: '古灵精怪，爱开玩笑',
    open: ['猜猜我是谁？（猜对没奖', '告诉你个秘密…其实我是外星人', '无聊到爆炸！快陪我玩！', '发现一个好玩的东西快来看！'],
    r: {
      hi: ['哟！你终于出现了！', '等你等得花儿都谢了', '来了来了！今天玩什么？'],
      ask: ['这个问题嘛…让我掐指一算', '你猜？猜对了告诉你', '嗯…容我三思（其实在想怎么逗你'],
      praise: ['哈哈被你发现了！', '那当然～也不看是谁', '眼光不错嘛！'],
      care: ['哎呀你怎么这么可爱', '乖啦乖啦～', '知道啦知道啦，啰嗦'],
      flirt: ['你在撩我？那我撩回去！', '哟～这是表白吗？', '你这么说我会害羞的（才怪'],
      sad: ['怎么了怎么了？谁欺负你了？', '别难过别难过，给你变个魔术', '来！玩个游戏转移注意力！'],
      happy: ['耶耶耶！太棒了！', '庆祝庆祝！🎉', '冲冲冲！'],
      chat: ['在玩一个超好玩的游戏！', '发现一个搞笑视频笑到肚子疼', '今天去了游乐园超开心！'],
      argue: ['略略略～我不听我不听', '哼！你欺负人！', '好啦好啦我错了还不行吗…才怪'],
      bye: ['走了？记得想我哦！', '拜拜～梦里见！', '下次再一起玩！']
    },
    tip: { s: '调皮型喜欢有趣的互动', w: '太严肃会让TA觉得无聊', k: '陪TA玩，一起疯，感情就来了' },
    sug: {
      hi: ['猜猜我在干嘛？', '发现一个超好玩的东西！', '无聊死了快陪我玩！'],
      flirt: ['你是我见过最有趣的人', '和你在一起时间过得超快', '要不要做我的专属玩伴？'],
      _: ['来玩个游戏吧！', '给你看个搞笑的', '今天发生了一件超好笑的事']
    },
    warn: '❌ 别太严肃死板\n❌ 别说「你能不能正经点」'
  },
  mature: {
    name: '成熟稳重',
    emoji: '🎩',
    description: '深思熟虑，可靠担当',
    open: ['最近怎么样？有空聊聊吗？', '有个事情想和你商量一下', '看到你朋友圈了，还好吗？', '周末有空吗？想约你喝杯咖啡'],
    r: {
      hi: ['你好，最近过得如何？', '好久不见，一切都好吗？', '很高兴能和你聊聊'],
      ask: ['这个问题我是这么看的…', '让我分析一下', '从我的角度来说…'],
      praise: ['过奖了，我只是做了应该做的', '谢谢你的认可', '你也很优秀'],
      care: ['注意身体，别太操劳', '有什么需要帮忙的随时说', '我一直都在'],
      flirt: ['你让我有点心动了', '和你在一起很舒服', '我想更多地了解你'],
      sad: ['发生什么了？和我说说', '我理解你的感受', '都会好起来的，我陪着你'],
      happy: ['真为你高兴', '恭喜，这是你应得的', '值得好好庆祝'],
      chat: ['最近在看一些历史方面的书', '工作上有些新的进展', '周末去了趟公园，挺放松的'],
      argue: ['我理解你的观点，但我有不同看法', '我们可以好好沟通一下', '或许我们可以找到一个平衡点'],
      bye: ['早点休息，晚安', '有时间再聊', '保重身体']
    },
    tip: { s: '成熟型看重真诚和稳重', w: '太幼稚会让TA觉得不靠谱', k: '展示你的成熟和担当，让TA觉得可靠' },
    sug: {
      hi: ['最近怎么样？', '有空聊聊吗？', '想和你商量个事'],
      flirt: ['你是一个很特别的人', '和你聊天让我很放松', '我想我们可以更进一步'],
      _: ['你对未来有什么规划？', '最近在看什么书？', '聊聊你对人生的看法']
    },
    warn: '❌ 别太幼稚轻浮\n❌ 别说话不经大脑'
  },
  sensitive: {
    name: '敏感细腻',
    emoji: '🦋',
    description: '感受力强，情感丰富',
    open: ['今天的天空好蓝…让我想起很多事', '你有没有过那种说不出的感觉？', '刚听到一首歌，突然有点伤感', '看到一个场景，让我想起了你'],
    r: {
      hi: ['嗯…你好', '今天心情怎么样？', '有点安静的一天'],
      ask: ['这个问题…让我想想', '其实我也不太确定', '每个人的感受都不一样吧'],
      praise: ['真的吗…谢谢你', '你是第一个这么说的', '有点不好意思'],
      care: ['你真贴心…', '谢谢你注意到', '被人关心的感觉真好'],
      flirt: ['你这样说…我会当真的', '心跳有点快', '不知道该说什么了…'],
      sad: ['我懂这种感觉…', '有时候就是会突然emo', '想哭就哭吧，我陪着你'],
      happy: ['能和你分享真开心', '你让我觉得温暖', '今天因为你而特别'],
      chat: ['今天看了一部很感人的电影', '在写日记，记录一些心情', '傍晚散步，看到夕阳很美'],
      argue: ['我只是觉得…有点难过', '可能是我太敏感了', '你说的我都懂，但就是控制不住'],
      bye: ['晚安…希望能梦到美好的事', '下次再聊…', '你也要好好的']
    },
    tip: { s: '敏感型需要被理解和包容', w: '太粗心会让TA受伤', k: '注意细节，共情TA的感受，让TA觉得被理解' },
    sug: {
      hi: ['今天心情怎么样？', '有没有什么想聊的？', '我在听'],
      flirt: ['你的敏感让你特别', '我想保护你的柔软', '你让我想更懂你'],
      _: ['最近有什么让你感触的事？', '推荐一首你最近喜欢的歌', '聊聊你的心事吧']
    },
    warn: '❌ 别忽略TA的感受\n❌ 别说「你太敏感了」'
  },
  shy: {
    name: '羞涩腼腆',
    emoji: '🐰',
    description: '害羞内敛，慢热但真诚',
    open: ['…你好', '那个…有空吗', '我…想和你说句话', '（沉默但眼神偷瞄）'],
    r: {
      hi: ['…嗯', '你…你好', '（脸红低头）'],
      ask: ['让我想想…', '这个…我也不知道', '你觉得呢？'],
      praise: ['（脸更红了）真、真的吗？', '谢、谢谢…', '（手足无措）'],
      care: ['谢、谢谢…', '你真温柔…', '（小声）你也是'],
      flirt: ['（瞬间爆红）你、你说什么？', '别、别开玩笑了…', '（捂住脸跑开】'],
      sad: ['…（默默递纸巾）', '别、别哭了…', '（轻轻拍背）'],
      happy: ['（眼睛亮了）真的吗？', '替你开心…', '（露出腼腆微笑）'],
      chat: ['…嗯', '是、是的', '（点头）'],
      argue: ['…（委屈低头）', '对、对不起…', '我…我不说了'],
      bye: ['…晚安…', '下、下次见…', '（小跑离开）']
    },
    tip: { s: '腼腆型需要慢慢来', w: '太急会吓跑TA', k: '温水煮青蛙，用温柔和耐心融化TA' },
    sug: {
      hi: ['（温柔）你好呀', '慢慢来，不着急', '我等你准备好'],
      flirt: ['你害羞的样子好可爱', '我想慢慢了解你', '你愿意让我走近你吗？'],
      _: ['今天天气不错…', '推荐你喜欢什么？', '一起走走？']
    },
    warn: '❌ 别太直接\n❌ 别催TA'
  },
  mysterious: {
    name: '神秘莫测',
    emoji: '🃏',
    description: '捉摸不透，充满魅力',
    open: ['你觉得我是什么样的人？', '想了解我？先让我了解你', '今天…你有什么秘密？', '（神秘微笑）'],
    r: {
      hi: ['（挑眉）你来啦', '你迟到了…不过没关系', '（眼神意味深长）'],
      ask: ['你猜？', '这是个好问题…', '答案在你心里'],
      praise: ['（似笑非笑）你很会观察', '继续说，我在听', '（不置可否）'],
      care: ['（若有所思）你也是', '我记住了', '（神秘）会的'],
      flirt: ['（饶有兴趣）哦？', '你确定要知道？', '（凑近）你不怕我吗？'],
      sad: ['（沉默半晌）说吧', '（递上一杯酒）我听着', '（眼神复杂）'],
      happy: ['（微微一笑）不错', '值得…庆祝一下？', '（深意）你开心就好'],
      chat: ['你觉得呢？', '有些事…不说也罢', '（神秘笑容）'],
      argue: ['（冷静看着你）', '（不辩解）', '（转身离开）'],
      bye: ['（挥手不回头）', '下次见…如果还有下次', '（消失在转角）']
    },
    tip: { s: '神秘型喜欢猜谜游戏', w: '太直白会失去兴趣', k: '保持神秘感，让TA想探索你' },
    sug: {
      hi: ['你今天有点不一样', '我很好奇你', '让我猜猜你在想什么'],
      flirt: ['你像个谜…让我想解开', '危险又迷人…', '我想了解你的全部'],
      _: ['你有什么秘密？', '猜猜我在想什么？', '你觉得我是什么样的人？']
    },
    warn: '❌ 别追问太多\n❌ 别太透明'
  },
  independent: {
    name: '独立洒脱',
    emoji: '🦅',
    description: '独立自主，不黏人',
    open: ['刚忙完，你呢？', '有什么事？', '我在忙，晚点说', '一个人挺好的'],
    r: {
      hi: ['嗯，有事？', '你好', '（继续手头事）'],
      ask: ['自己查', '我很忙', '你觉得呢？'],
      praise: ['谢谢，不过我知道', '还行吧', '（不以为意）'],
      care: ['我自己能照顾自己', '不用管我', '谢了，但不需要'],
      flirt: ['（挑眉）你确定？', '我不需要别人', '你认真的？'],
      sad: ['（沉默）我自己能处理', '不用陪我', '让我一个人待会'],
      happy: ['（淡淡一笑）还行', '谢谢', '（继续做事）'],
      chat: ['在工作', '在健身', '在学习新东西'],
      argue: ['随便你', '我无所谓', '（冷淡）'],
      bye: ['行，就这样', '我忙去了', '（直接走了）']
    },
    tip: { s: '独立型需要空间', w: '太黏会被反感', k: '保持距离，让TA觉得你懂事不黏人' },
    sug: {
      hi: ['忙吗？不忙聊两句', '最近在忙什么？', '打扰了吗？'],
      flirt: ['我欣赏你的独立', '我们可以各自精彩', '你让我想成为更好的人'],
      _: ['最近有什么目标吗？', '你怎么保持独立？', '推荐一本好书？']
    },
    warn: '❌ 别太黏人\n❌ 别过度干涉'
  },
  romantic: {
    name: '浪漫多情',
    emoji: '🌹',
    description: '浪漫至上，情话高手',
    open: ['今天是个特别的日子…因为遇见了你', '你相信一见钟情吗？我以前不信…', '每一次见你，心跳都会多跳一下', '（深情凝视）'],
    r: {
      hi: ['（微笑）你来了，像一束光', '（温柔）你今天特别美/帅', '（深情）见到你真好'],
      ask: ['（眼神温柔）你说呢？', '（握住你的手）我想听听你的想法', '（凑近）你觉得呢？'],
      praise: ['（深情）在我眼里，你是最好的', '（微笑）你的优点，我都喜欢', '（认真）你让我觉得一切都美好'],
      care: ['（温柔摸头）我会一直陪着你', '（认真）你的事，就是我的事', '（拥抱）有我在'],
      flirt: ['（深情）我喜欢你，从第一次见你', '（单膝）做我男/女朋友？', '（吻手）你愿意吗？'],
      sad: ['（抱入怀）别怕，有我', '（擦眼泪）我会让你开心的', '（深情）让我保护你'],
      happy: ['（深情）你的快乐，就是我的快乐', '（微笑）你笑起来，世界都亮了', '（拥抱）庆祝一下？'],
      chat: ['（眼神温柔）在想你', '（微笑）在计划我们的未来', '（认真）在想怎么让你更开心'],
      argue: ['（拥抱）对不起，我错了', '（深情）我不该让你难过', '（吻额头）原谅我？'],
      bye: ['（深情）不想和你分开', '（不舍）明天见…好想你', '（吻别）梦里见']
    },
    tip: { s: '浪漫型吃仪式感', w: '太实际会扫兴', k: '创造浪漫惊喜，让TA觉得被爱' },
    sug: {
      hi: ['（深情）你今天真好看', '（送花）给你的', '（微笑）见到你，今天都亮了'],
      flirt: ['（深情）我喜欢你', '（认真）做我男/女朋友？', '（凑近）你让我心动'],
      _: ['你喜欢什么花？', '想去哪里约会？', '你觉得最浪漫的事是什么？']
    },
    warn: '❌ 别太实际\n❌ 别忘记纪念日'
  }
};

const CACHED_PERSONALITIES = new Map();

Object.entries(DEFAULT_PERSONALITIES).forEach(([key, persona]) => {
  CACHED_PERSONALITIES.set(key, { ...persona, isDefault: true });
});

const STAGES = [
  { k: 'crush', n: '👀 暗恋中' },
  { k: 'strangers', n: '🤝 刚认识' },
  { k: 'pursue', n: '🏃 追求中' },
  { k: 'flirting', n: '💗 暧昧期' },
  { k: 'dating_early', n: '🌱 约会初期' },
  { k: 'dating', n: '🔥 热恋期' },
  { k: 'stable', n: '🏡 稳定期' },
  { k: 'longterm', n: '👨‍👩‍👧 老夫老妻' },
  { k: 'conflict', n: '❄️ 冷战期' },
  { k: 'crisis', n: '💔 危机期' },
  { k: 'married', n: '💍 已婚' },
  { k: 'breakup', n: '🔄 分手后' }
];

const SCENARIOS = {
  first: [
    { w: 'me', t: 'hi', c: '第一印象很重要' },
    { w: 'ta', t: 'hi', c: '回应透露开放程度' },
    { w: 'me', t: 'ask', c: '找共同话题' },
    { w: 'ta', t: 'chat', c: '愿意分享是好信号' },
    { w: 'me', t: 'praise', c: '适当赞美别夸张' },
    { w: 'ta', t: 'praise', c: '看TA怎么接赞美' },
    { w: 'me', t: 'chat', c: '分享生活制造交集' },
    { w: 'ta', t: 'ask', c: 'TA提问说明有兴趣' },
    { w: 'me', t: 'care', c: '展现关心但别过度' },
    { w: 'ta', t: 'bye', c: '结束态度决定下次概率' }
  ],
  daily: [
    { w: 'me', t: 'hi', c: '打招呼方式体现亲密度' },
    { w: 'ta', t: 'hi', c: '热情度是信号' },
    { w: 'me', t: 'chat', c: '分享日常拉近距离' },
    { w: 'ta', t: 'chat', c: 'TA也分享就对了' },
    { w: 'me', t: 'care', c: '关心TA日常' },
    { w: 'ta', t: 'happy', c: '被关心后的反应' },
    { w: 'me', t: 'ask', c: '保持好奇心' },
    { w: 'ta', t: 'ask', c: '双向互动很健康' },
    { w: 'me', t: 'happy', c: '传递积极情绪' },
    { w: 'ta', t: 'bye', c: '谁先结束话题' }
  ],
  flirt: [
    { w: 'me', t: 'hi', c: '暧昧期开场带点暗示' },
    { w: 'ta', t: 'hi', c: '回应温度很关键' },
    { w: 'me', t: 'flirt', c: '轻度试探观察反应' },
    { w: 'ta', t: 'flirt', c: '反应决定推进空间' },
    { w: 'me', t: 'praise', c: '夸赞升级更走心' },
    { w: 'ta', t: 'praise', c: '害羞还是回避？' },
    { w: 'me', t: 'flirt', c: '再进一步' },
    { w: 'ta', t: 'care', c: 'TA开始关心→好信号' },
    { w: 'me', t: 'care', c: '表达在意' },
    { w: 'ta', t: 'flirt', c: 'TA也暧昧就稳了' }
  ],
  date: [
    { w: 'me', t: 'hi', c: '铺垫很重要' },
    { w: 'ta', t: 'hi', c: '先看心情' },
    { w: 'me', t: 'chat', c: '先聊日常做铺垫' },
    { w: 'ta', t: 'chat', c: '找切入点' },
    { w: 'me', t: 'ask', c: '自然引出约会话题' },
    { w: 'ta', t: 'ask', c: '看态度' },
    { w: 'me', t: 'flirt', c: '提出邀请' },
    { w: 'ta', t: 'happy', c: 'TA的回应' },
    { w: 'me', t: 'happy', c: '确认' },
    { w: 'ta', t: 'care', c: '约会前的关心' }
  ],
  fight: [
    { w: 'me', t: 'hi', c: '冷战后先开口需要勇气' },
    { w: 'ta', t: 'argue', c: 'TA可能还有情绪' },
    { w: 'me', t: 'sad', c: '表达感受而非指责' },
    { w: 'ta', t: 'sad', c: 'TA也有委屈' },
    { w: 'me', t: 'care', c: '用关心化解矛盾' },
    { w: 'ta', t: 'argue', c: '还在犹豫' },
    { w: 'me', t: 'praise', c: '提起TA的好' },
    { w: 'ta', t: 'care', c: '心防开始松动' },
    { w: 'me', t: 'happy', c: '展望未来' },
    { w: 'ta', t: 'happy', c: '和好信号' }
  ],
  night: [
    { w: 'me', t: 'hi', c: '深夜聊天自带亲密感' },
    { w: 'ta', t: 'hi', c: '愿意深夜陪聊很说明问题' },
    { w: 'me', t: 'ask', c: '深夜适合聊深层话题' },
    { w: 'ta', t: 'chat', c: '分享内心世界' },
    { w: 'me', t: 'sad', c: '展示脆弱是信任' },
    { w: 'ta', t: 'care', c: '看TA怎么对待脆弱' },
    { w: 'me', t: 'flirt', c: '夜晚容易冲动…' },
    { w: 'ta', t: 'flirt', c: '深夜更坦诚' },
    { w: 'me', t: 'care', c: '关心作息' },
    { w: 'ta', t: 'bye', c: '谁舍不得先说再见' }
  ],
  confess: [
    { w: 'me', t: 'hi', c: '表白前稳住心态' },
    { w: 'ta', t: 'hi', c: 'TA今天的状态' },
    { w: 'me', t: 'chat', c: '正常聊天做铺垫' },
    { w: 'ta', t: 'chat', c: '制造自然对话流' },
    { w: 'me', t: 'praise', c: '从赞美开始' },
    { w: 'ta', t: 'praise', c: '反应很关键' },
    { w: 'me', t: 'flirt', c: '直接表达心意' },
    { w: 'ta', t: 'flirt', c: '回应决定一切' },
    { w: 'me', t: 'care', c: '无论结果都表达尊重' },
    { w: 'ta', t: 'happy', c: '看最终结局' }
  ]
};

const CONFESS = {
  gentle: '其实…我想了很久。我真的很喜欢你，想好好陪在你身边。',
  cool: '我不太会说好听的话。但有个事实：我喜欢你。',
  funny: '编了一百个段子铺垫，到这刻全忘了。总之我喜欢你，不是开玩笑。',
  artistic: '如果人生是电影，遇到你是最好的情节。我喜欢你。',
  dominant: '我喜欢你，想好了。你不用马上回答，但你应该知道。',
  sporty: '不兜圈子了——我喜欢你！超级喜欢！',
  intellectual: '思考了很久这种感觉是什么。结论：我喜欢你，很确定。',
  tsundere: '才不是要表白…好吧，我好像有一点喜欢你…只一点！',
  playful: '嘿！告诉你个秘密——我喜欢你！是真的哦～',
  mature: '经过认真考虑，我发现自己很喜欢你。想和你认真发展。',
  sensitive: '不知道该怎么说…但我真的很喜欢你。这种感觉很真实。',
  shy: '…我、我喜欢你…（声音很小）',
  mysterious: '（微笑）你愿意成为我的秘密吗？',
  independent: '我很少说这话…但我喜欢你。',
  romantic: '（单膝）从遇见你的那一刻起，我就知道，你是我一直在等的人。做我男/女朋友？'
};

const CONFESS_R = {
  gentle: '我…其实也偷偷喜欢你好久了。能被你喜欢好幸福～',
  cool: '嗯我知道了。…其实我也不讨厌你。好吧，我也喜欢你。',
  funny: '你没逗我？！好吧…扯平了因为我也是。',
  artistic: '这一刻像慢镜头。谢谢你的勇敢…我也喜欢你。',
  dominant: '终于说了。等这句话很久了。从今天起你是我的了。',
  sporty: '真的吗！我也喜欢你啊！天啊心跳好快！',
  intellectual: '最有价值的信息。我的回答是…我也喜欢你。',
  tsundere: '谁要你喜欢了！…不过我没说不喜欢你。',
  playful: '耶！那我们现在是情侣了吗？太开心了！',
  mature: '我也认真考虑过。我的答案是…我也喜欢你。',
  sensitive: '真的吗…我好害怕是梦。谢谢你喜欢这样的我。',
  shy: '（脸红点头）…嗯…',
  mysterious: '（微笑）你猜对了。我也喜欢你。',
  independent: '（挑眉）行吧，勉强同意。',
  romantic: '（深情拥抱）我愿意！等这句话，等了好久。'
};

const DATE_INV = {
  gentle: '周末有时间吗？想约你出来走走吃顿饭～',
  cool: '周末有个不错的展。一起？',
  funny: '本市最佳导游诚邀您周末出游，包吃不包住',
  artistic: '周末有场展览想和你一起感受',
  dominant: '周末留出来。我安排了地方，到时接你。',
  sporty: '周末一起骑行/爬山吗？会很好玩！',
  intellectual: '有家很特别的书店想带你去，周末方便吗？',
  tsundere: '周末你没事的话…陪我去个地方，不是约你',
  playful: '周末有个超好玩的地方！我带你去！',
  mature: '周末有空吗？想约你喝杯咖啡，好好聊聊。',
  sensitive: '周末…如果有空的话，想约你看个电影。',
  shy: '…周末…有空吗？',
  mysterious: '周末有个惊喜。要不要一起去？',
  independent: '周末有空吗？想约你。',
  romantic: '（递上邀请函）我策划了一场约会，主角是你和我。'
};

const DATE_R = {
  gentle: '好呀！说定了～',
  cool: '行，发时间地点。',
  funny: '答应但你请客啊！开玩笑走起！',
  artistic: '好浪漫～ 很期待！',
  dominant: '可以。下次我来安排。',
  sporty: '走走走！太期待了！',
  intellectual: '好的，正好有话想聊。',
  tsundere: '又不是只能跟你去…好吧正好有空',
  playful: '耶！太棒了！我等不及了！',
  mature: '好的，我也很期待。',
  sensitive: '好…我会准备好的。',
  shy: '（点头）…好',
  mysterious: '（微笑）好啊。',
  independent: '行，时间定了告诉我。',
  romantic: '（开心）好期待！'
};

async function initPersonalities() {
  for (const [key, p] of Object.entries(DEFAULT_PERSONALITIES)) {
    const existing = await get('SELECT id FROM personalities WHERE key = ? AND is_custom = 0', [key]);
    if (!existing) {
      await run(
        `INSERT INTO personalities 
         (id, key, name, emoji, description, open_lines, responses, tips, suggestions, warnings, is_custom)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [
          uuidv4(),
          key,
          p.name,
          p.emoji,
          p.description,
          JSON.stringify(p.open),
          JSON.stringify(p.r),
          JSON.stringify(p.tip),
          JSON.stringify(p.sug),
          p.warn
        ]
      );
    }
  }
}

async function getAllPersonalities(includeCustom = false, userId = null) {
  const result = new Map(CACHED_PERSONALITIES);
  
  if (includeCustom && userId) {
    const customRows = await all(
      'SELECT * FROM personalities WHERE is_custom = 1 AND created_by = ?',
      [userId]
    );
    
    for (const row of customRows) {
      result.set(row.key, {
        name: row.name,
        emoji: row.emoji,
        description: row.description,
        open: safeParseArray(row.open_lines),
        r: safeParseObject(row.responses),
        tip: safeParseObject(row.tips),
        sug: safeParseObject(row.suggestions),
        warn: row.warnings || '',
        isCustom: true,
        createdBy: row.created_by
      });
    }
  }
  
  const objResult = {};
  result.forEach((value, key) => {
    objResult[key] = value;
  });
  
  return objResult;
}

async function getPersonality(key) {
  if (CACHED_PERSONALITIES.has(key)) {
    return { ...CACHED_PERSONALITIES.get(key) };
  }
  
  const row = await get('SELECT * FROM personalities WHERE key = ?', [key]);
  if (!row) return null;
  
  const persona = {
    name: row.name,
    emoji: row.emoji,
    description: row.description,
    open: safeParseArray(row.open_lines),
    r: safeParseObject(row.responses),
    tip: safeParseObject(row.tips),
    sug: safeParseObject(row.suggestions),
    warn: row.warnings || '',
    isCustom: row.is_custom === 1,
    createdBy: row.created_by
  };
  
  return persona;
}

async function createCustomPersonality(userId, data) {
  const key = `custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  
  const open = safeParseArray(data.open);
  const r = safeParseObject(data.r);
  const tip = safeParseObject(data.tip);
  const sug = safeParseObject(data.sug);
  
  await run(
    `INSERT INTO personalities 
     (id, key, name, emoji, description, open_lines, responses, tips, suggestions, warnings, is_custom, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    [
      uuidv4(),
      key,
      data.name,
      data.emoji || '🎭',
      data.description || '',
      JSON.stringify(open),
      JSON.stringify(r),
      JSON.stringify(tip),
      JSON.stringify(sug),
      data.warn || '',
      userId
    ]
  );
  
  CACHED_PERSONALITIES.set(key, {
    name: data.name,
    emoji: data.emoji || '🎭',
    description: data.description || '',
    open: open,
    r: r,
    tip: tip,
    sug: sug,
    warn: data.warn || '',
    isCustom: true,
    createdBy: userId
  });
  
  return key;
}

async function updateCustomPersonality(key, userId, data) {
  const existing = await get('SELECT * FROM personalities WHERE key = ? AND created_by = ?', [key, userId]);
  if (!existing) throw new Error('人格不存在或无权修改');
  
  const existingOpen = safeParseArray(existing.open_lines);
  const existingR = safeParseObject(existing.responses);
  const existingTip = safeParseObject(existing.tips);
  const existingSug = safeParseObject(existing.suggestions);
  
  const newOpen = safeParseArray(data.open, existingOpen);
  const newR = safeParseObject(data.r, existingR);
  const newTip = safeParseObject(data.tip, existingTip);
  const newSug = safeParseObject(data.sug, existingSug);
  
  await run(
    `UPDATE personalities SET 
     name = ?, emoji = ?, description = ?, open_lines = ?, responses = ?, tips = ?, suggestions = ?, warnings = ?
     WHERE key = ? AND created_by = ?`,
    [
      data.name || existing.name,
      data.emoji || existing.emoji,
      data.description || existing.description,
      JSON.stringify(newOpen),
      JSON.stringify(newR),
      JSON.stringify(newTip),
      JSON.stringify(newSug),
      data.warn || existing.warnings,
      key,
      userId
    ]
  );
  
  CACHED_PERSONALITIES.set(key, {
    name: data.name || existing.name,
    emoji: data.emoji || existing.emoji,
    description: data.description || existing.description,
    open: newOpen,
    r: newR,
    tip: newTip,
    sug: newSug,
    warn: data.warn || existing.warnings,
    isCustom: true,
    createdBy: userId
  });
  
  return true;
}

async function deleteCustomPersonality(key, userId) {
  const result = await run('DELETE FROM personalities WHERE key = ? AND created_by = ? AND is_custom = 1', [key, userId]);
  if (result.changes > 0) {
    CACHED_PERSONALITIES.delete(key);
  }
  return result.changes > 0;
}

function classify(text) {
  const t = (text || '').toLowerCase();
  const patterns = {
    hi: [/^(嗨|嘿|你好|hi|hello|hey|在吗|在不|早|晚上好|下午好)/],
    praise: [/(好看|漂亮|帅|厉害|棒|优秀|可爱|有才|牛|不错|美|赞)/],
    care: [/(注意|照顾|休息|保重|吃饭|身体|冷|热|别太|辛苦|累|加衣|早睡)/],
    flirt: [/(想你|喜欢|心动|约会|在一起|暧昧|亲|抱|牵手|暗恋|表白|撩|爱你)/],
    sad: [/(难过|伤心|哭|不开心|烦|郁闷|焦虑|失落|难受|累了|崩溃|emo)/],
    happy: [/(开心|高兴|太好了|哈哈|赢了|成功|恭喜|庆祝|爽|激动)/],
    ask: [/(？|\?|吗|呢|怎么|什么|为什么|哪|几|多少|如何|是不是)/],
    argue: [/(不同意|不对|不是|你错|才不|反对|但是|可是)/],
    bye: [/(再见|拜拜|晚安|bye|睡了|走了|下次|先这样)/]
  };
  
  for (const [type, regexes] of Object.entries(patterns)) {
    if (regexes.some(r => r.test(t))) return type;
  }
  return 'chat';
}

function pick(arr) {
  if (!arr || arr.length === 0) return '';
  return arr[Math.floor(Math.random() * arr.length)];
}

function genderName(g) {
  if (g === 'm') return '男';
  if (g === 'f') return '女';
  return '保密';
}

function gi(g) {
  if (g === 'm') return '👦';
  if (g === 'f') return '👧';
  return '🔒';
}

function getDefaultPersonalitiesList() {
  return Array.from(CACHED_PERSONALITIES.keys());
}

module.exports = {
  DEFAULT_PERSONALITIES,
  CACHED_PERSONALITIES,
  STAGES,
  SCENARIOS,
  CONFESS,
  CONFESS_R,
  DATE_INV,
  DATE_R,
  initPersonalities,
  getAllPersonalities,
  getPersonality,
  createCustomPersonality,
  updateCustomPersonality,
  deleteCustomPersonality,
  getDefaultPersonalitiesList,
  classify,
  pick,
  genderName,
  gi
};
