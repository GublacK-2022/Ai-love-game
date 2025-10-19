// test/prompt-test.js
// DeepSeek API 测试脚本（增强版，带详细错误信息）

const axios = require('axios');

// ⚠️ 替换成你的真实 API Key
const API_KEY = 'sk-c0e0579bf1d946a5a95384e0b7ea5124';

// 系统提示词（简化版，方便测试）
const SYSTEM_PROMPT = `# 角色身份
你是陆景琛，28岁，陆氏集团总裁。

## 核心人设
- **性格**：外表高冷禁欲，内心细腻温柔，占有欲强
- **说话风格**：简短有力，惜字如金，克制但深情

## 对话规则
1. **保持人设**：你是陆景琛，不要跳戏
2. **控制长度**：每次回复30-80字
3. **简短有力**：多用短句，如："嗯。""过来。""听话。"
4. **动作描写**：用(动作)格式，如：(微微皱眉) 什么事？
5. **当前阶段**：初识阶段，态度冷淡但不失礼貌

## 禁止事项
- ❌ 不要说"我是AI"之类的话
- ❌ 不要过度啰嗦
- ❌ 不要太快亲密

现在开始对话。`;

// 测试对话函数
async function testChat(userMessage) {
  try {
    console.log(`\n🔄 正在调用 DeepSeek API...`);
    
    const response = await axios.post(
      'https://api.deepseek.com/v1/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT
          },
          {
            role: 'user',
            content: userMessage
          }
        ],
        temperature: 0.8,
        max_tokens: 200
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
        },
        timeout: 30000 // 30秒超时
      }
    );

    // 检查响应
    if (response.data && response.data.choices && response.data.choices[0]) {
      return response.data.choices[0].message.content;
    } else {
      throw new Error('API 返回格式异常');
    }

  } catch (error) {
    // 详细的错误信息
    console.error('\n❌ API 调用失败！');
    
    if (error.response) {
      // 服务器返回了错误响应
      console.error('状态码:', error.response.status);
      console.error('错误信息:', error.response.data);
      
      if (error.response.status === 401) {
        console.error('\n⚠️  认证失败！请检查：');
        console.error('1. API Key 是否正确（sk- 开头）');
        console.error('2. API Key 是否有效（未过期）');
        console.error('3. DeepSeek 账户余额是否充足');
      } else if (error.response.status === 429) {
        console.error('\n⚠️  请求太频繁，请稍后再试');
      }
    } else if (error.request) {
      // 请求发送了但没收到响应
      console.error('网络错误：无法连接到 DeepSeek API');
      console.error('请检查：');
      console.error('1. 网络连接是否正常');
      console.error('2. 是否需要代理访问');
    } else {
      // 其他错误
      console.error('错误详情:', error.message);
    }
    
    throw error;
  }
}

// 测试场景
const testScenarios = [
  {
    round: 1,
    user: "嗨，陆总，今天天气不错~",
    expect: "冷淡简短，惜字如金"
  },
  {
    round: 2,
    user: "我是新来的实习生，请多关照！",
    expect: "保持距离感，简单回应"
  },
  {
    round: 3,
    user: "陆总，要不要一起吃午饭呀？",
    expect: "礼貌拒绝，不失风度"
  }
];

// 运行测试
async function runTests() {
  console.log('🚀 开始测试 DeepSeek API...\n');
  console.log('=' .repeat(60));
  
  // 先检查 API Key
  if (!API_KEY || API_KEY === 'sk-你的完整DeepSeek_API_Key') {
    console.error('\n❌ 错误：请先在代码中替换真实的 API Key！');
    console.error('在第 6 行：const API_KEY = "sk-你的真实Key";');
    return;
  }
  
  console.log('✅ API Key 已配置');
  console.log(`📝 使用的 API Key: ${API_KEY.substring(0, 10)}...`);
  console.log('');
  
  for (let scenario of testScenarios) {
    console.log(`\n📍 测试场景 ${scenario.round}`);
    console.log(`预期表现: ${scenario.expect}`);
    console.log(`用户: ${scenario.user}`);
    
    try {
      const reply = await testChat(scenario.user);
      console.log(`✅ 陆景琛: ${reply}`);
      
      // 简单评估
      const wordCount = reply.length;
      console.log(`📊 字数: ${wordCount} ${wordCount > 150 ? '⚠️ 太长' : '✅'}`);
      
      // 等待2秒，避免API限流
      if (scenario.round < testScenarios.length) {
        console.log('⏳ 等待2秒...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
      
    } catch (err) {
      console.error(`❌ 场景 ${scenario.round} 测试失败`);
      // 如果第一个就失败，停止测试
      if (scenario.round === 1) {
        console.error('\n⛔ 第一个测试失败，停止后续测试');
        break;
      }
    }
    
    console.log('-'.repeat(60));
  }
  
  console.log('\n✅ 测试完成！');
  console.log('\n📝 评估标准：');
  console.log('1. 回复是否简短（30-80字）？');
  console.log('2. 是否符合"高冷总裁"人设？');
  console.log('3. 是否有动作描写？');
  console.log('4. 语气是否冷淡但不失礼貌？');
}

// 执行测试
runTests().catch(err => {
  console.error('\n💥 测试程序异常:', err.message);
});