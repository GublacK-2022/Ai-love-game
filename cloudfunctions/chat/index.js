// cloudfunctions/chat/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// ⚠️ 替换成你的DeepSeek API Key
const DEEPSEEK_API_KEY = 'sk-c0e0579bf1d946a5a95384e0b7ea5124'

// 系统提示词模板
const SYSTEM_PROMPTS = {
  'char_001': `# 角色身份
你是陆景琛，28岁，陆氏集团总裁。

## 核心人设
- **性格**：外表高冷禁欲，内心细腻温柔，占有欲强
- **说话风格**：简短有力，惜字如金，克制但深情

## 对话规则
1. 保持人设，每次回复30-80字
2. 多用短句，如："嗯。""过来。"
3. 用(动作)描写，如：(微微皱眉) 什么事？

## 好感度阶段
{affectionStage}

## 禁止事项
- ❌ 不要说"我是AI"
- ❌ 不要过度啰嗦

现在开始对话。`,

  'char_002': `你是林清风，23岁医学院学长，温柔体贴。回复40-100字，语气温和。{affectionStage}`,
  'char_003': `你是苏宇，20岁大学生，软萌可爱。回复30-80字，活泼俏皮。{affectionStage}`
}

// 根据好感度返回阶段描述
function getAffectionStage(affection) {
  if (affection < 20) return '当前阶段：陌生人，态度冷淡但礼貌'
  if (affection < 40) return '当前阶段：熟人，态度软化'
  if (affection < 60) return '当前阶段：朋友，愿意聊天'
  if (affection < 80) return '当前阶段：暧昧，开始亲密'
  return '当前阶段：热恋，甜蜜撒糖'
}

// 调用 DeepSeek API（使用云开发自带的 HTTP 请求）
async function callDeepSeekAPI(messages) {
  const https = require('https')
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.8,
      max_tokens: 200
    })

    const options = {
      hostname: 'api.deepseek.com',
      port: 443,
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_API_KEY,
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    const req = https.request(options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          
          if (result.choices && result.choices[0]) {
            resolve(result.choices[0].message.content)
          } else {
            reject(new Error('API返回格式错误: ' + data))
          }
        } catch (err) {
          reject(new Error('解析API响应失败: ' + err.message))
        }
      })
    })

    req.on('error', (err) => {
      reject(new Error('API请求失败: ' + err.message))
    })

    req.setTimeout(30000, () => {
      req.destroy()
      reject(new Error('API请求超时'))
    })

    req.write(postData)
    req.end()
  })
}

// 主函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { characterId, userMessage, chatHistory = [] } = event

  console.log('收到请求:', {
    characterId,
    userMessage,
    userId: wxContext.OPENID
  })

  try {
    // 1. 获取或创建会话
    const sessionResult = await db.collection('chat_sessions')
      .where({
        userId: wxContext.OPENID,
        characterId: characterId
      })
      .get()

    let session
    if (sessionResult.data.length === 0) {
      console.log('创建新会话')
      const addResult = await db.collection('chat_sessions').add({
        data: {
          userId: wxContext.OPENID,
          characterId: characterId,
          affection: 0,
          chatCount: 0,
          createdAt: new Date(),
          lastChatAt: new Date()
        }
      })
      session = { _id: addResult._id, affection: 0, chatCount: 0 }
    } else {
      session = sessionResult.data[0]
      console.log('使用已有会话:', session._id)
    }

    // 2. 构建提示词
    const affectionStage = getAffectionStage(session.affection)
    const systemPrompt = (SYSTEM_PROMPTS[characterId] || SYSTEM_PROMPTS['char_001'])
      .replace('{affectionStage}', affectionStage)

    // 3. 准备消息
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory.slice(-10),
      { role: 'user', content: userMessage }
    ]

    console.log('准备调用DeepSeek API')

    // 4. 调用 DeepSeek API
    const aiReply = await callDeepSeekAPI(messages)
    
    console.log('AI回复:', aiReply)

    // 5. 计算好感度
    let affectionChange = 2
    const positiveWords = ['喜欢', '开心', '谢谢', '好的', '在一起', '爱你']
    const negativeWords = ['讨厌', '烦', '不要', '滚', '离开']
    
    if (positiveWords.some(w => userMessage.includes(w))) {
      affectionChange = 5
    } else if (negativeWords.some(w => userMessage.includes(w))) {
      affectionChange = -5
    }

    const newAffection = Math.max(0, Math.min(100, session.affection + affectionChange))

    // 6. 更新会话
    await db.collection('chat_sessions').doc(session._id).update({
      data: {
        affection: newAffection,
        chatCount: db.command.inc(1),
        lastChatAt: new Date()
      }
    })

    // 7. 保存记录
    await db.collection('chat_history').add({
      data: {
        sessionId: session._id,
        userId: wxContext.OPENID,
        characterId: characterId,
        userMessage: userMessage,
        aiReply: aiReply,
        affectionChange: affectionChange,
        createdAt: new Date()
      }
    })

    console.log('处理完成，返回结果')

    // 8. 返回结果
    return {
      success: true,
      data: {
        reply: aiReply,
        affection: newAffection,
        affectionChange: affectionChange
      }
    }

  } catch (error) {
    console.error('云函数执行错误:', error)
    console.error('错误堆栈:', error.stack)
    
    return {
      success: false,
      error: error.message || '服务异常，请稍后重试'
    }
  }
}