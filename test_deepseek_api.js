// test-deepseek.js
// 这个脚本用来测试DeepSeek API是否正常工作

const https = require('https');

const testDeepSeek = () => {
  const data = JSON.stringify({
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content: '你是一个28岁的霸道总裁，名叫陆景琛。性格高冷但内心温柔。'
      },
      {
        role: 'user',
        content: '你好，陆总~'
      }
    ],
    temperature: 0.8,
    max_tokens: 100
  });

  const options = {
    hostname: 'api.deepseek.com',
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sk-c0e0579bf1d946a5a95384e0b7ea5124'
    }
  };

  const req = https.request(options, (res) => {
    let body = '';
    
    res.on('data', (chunk) => {
      body += chunk;
    });
    
    res.on('end', () => {
      try {
        const response = JSON.parse(body);
        console.log('\n✅ API调用成功！');
        console.log('AI回复：', response.choices[0].message.content);
        console.log('\n这就是你的AI角色会说的话！');
      } catch (err) {
        console.error('❌ 解析响应失败:', err);
        console.log('原始响应:', body);
      }
    });
  });

  req.on('error', (err) => {
    console.error('❌ API调用失败:', err);
  });

  req.write(data);
  req.end();
};

console.log('🚀 开始测试 DeepSeek API...\n');
testDeepSeek();