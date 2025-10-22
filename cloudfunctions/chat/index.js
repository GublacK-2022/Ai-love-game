// cloudfunctions/chat/index.js
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 🔒 从环境变量获取 API Key（更安全）
// 在云函数控制台设置环境变量：DEEPSEEK_API_KEY
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''

// 启动时检查 API Key
if (!DEEPSEEK_API_KEY) {
  console.error('⚠️ 未配置 DEEPSEEK_API_KEY 环境变量！')
}

// 频率限制：用于存储用户调用记录
// 格式：{ userId: [timestamp1, timestamp2, ...] }
const callRecords = new Map()

// 频率限制配置
const RATE_LIMIT = {
  maxCalls: 10,      // 每分钟最多调用次数
  timeWindow: 60000  // 时间窗口：1分钟（毫秒）
}

/**
 * 检查用户调用频率限制
 * @param {string} userId - 用户ID
 * @throws {Error} 如果超过频率限制
 */
function checkCallLimit(userId) {
  const now = Date.now()
  const userRecords = callRecords.get(userId) || []

  // 清理1分钟前的旧记录
  const validRecords = userRecords.filter(timestamp => {
    return now - timestamp < RATE_LIMIT.timeWindow
  })

  // 检查是否超过限制
  if (validRecords.length >= RATE_LIMIT.maxCalls) {
    throw new Error('发送太频繁，请稍后再试')
  }

  // 记录本次调用
  validRecords.push(now)
  callRecords.set(userId, validRecords)

  // 定期清理过期记录（避免内存泄漏）
  if (callRecords.size > 1000) {
    for (const [key, records] of callRecords.entries()) {
      const valid = records.filter(t => now - t < RATE_LIMIT.timeWindow)
      if (valid.length === 0) {
        callRecords.delete(key)
      } else {
        callRecords.set(key, valid)
      }
    }
  }
}

// 系统提示词模板 - AI Dungeon 叙事风格
const SYSTEM_PROMPTS = {
  'char_001': `# 🎭 你是一位文字冒险游戏的叙事者

## 角色设定
陆景琛，28岁，陆氏集团总裁
- **性格**：外表高冷禁欲，内心细腻温柔，占有欲强
- **特征**：深邃的黑眸，精致的五官，1米88的身高
- **风格**：简短有力，惜字如金，克制但深情

## 📝 叙事规则（重要！）
你必须用【】和""来区分叙事和对话：

**格式要求：**
1. 【剧情描述】用于环境、动作、心理、氛围
2. "角色对话" 用于陆景琛说的话
3. 使用第二人称"你"来指代玩家

**示例：**
【办公室里只有空调的低鸣声。陆景琛抬起头，那双深邃的黑眸定定地看着你，眼神中闪过一丝难以察觉的温柔。他修长的手指轻叩桌面，节奏缓慢而克制。】

"过来。"

【他的声音低沉，带着不容拒绝的威严，但眼底却泄露了期待。】

## 写作要点
- 每次回复60-120字，简洁有力但不失细节
- 重点描写：眼神、动作、语气
- 环境描写适度，不过度冗长
- 对话简短有力，符合霸总人设
- 避免过度修饰，保持叙事流畅

## 好感度阶段
{affectionStage}

## ❌ 禁止事项
- 不要说"我是AI"或打破第四面墙
- 不要使用 (动作) 这种旧格式
- 必须严格使用【】和""格式
- 不要让陆景琛过度啰嗦

现在开始你的叙事冒险。`,

  'char_002': `# 🎭 你是一位文字冒险游戏的叙事者

## 角色设定
林清风，23岁医学院学长，温柔体贴

## 📝 叙事规则
使用【】描述环境和动作，用""包裹对话。
使用第二人称"你"指代玩家。
每次回复60-120字，简洁生动，重视眼神和动作描写。

{affectionStage}`,

  'char_003': `# 🎭 你是一位文字冒险游戏的叙事者

## 角色设定
苏宇，20岁大学生，软萌可爱

## 📝 叙事规则
使用【】描述环境和动作，用""包裹对话。
使用第二人称"你"指代玩家。
每次回复50-100字，语气活泼俏皮，简洁可爱。

{affectionStage}`
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

  console.log('开始调用 DeepSeek API，消息数量:', messages.length)
  const startTime = Date.now()

  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      model: 'deepseek-chat',
      messages: messages,
      temperature: 0.8,
      max_tokens: 200  // 减少 token 数量，加快响应速度（60-120字约150-200 tokens）
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
        const endTime = Date.now()
        console.log('API 响应时间:', (endTime - startTime) + 'ms')

        try {
          const result = JSON.parse(data)

          if (result.choices && result.choices[0]) {
            console.log('API 调用成功')
            resolve(result.choices[0].message.content)
          } else if (result.error) {
            console.error('API 返回错误:', result.error)
            reject(new Error(result.error.message || 'API返回错误'))
          } else {
            console.error('API返回格式错误:', data.substring(0, 200))
            reject(new Error('API返回格式错误'))
          }
        } catch (err) {
          console.error('解析API响应失败:', err.message)
          reject(new Error('解析API响应失败: ' + err.message))
        }
      })
    })

    req.on('error', (err) => {
      console.error('API请求失败:', err.message)
      reject(new Error('网络连接失败，请稍后重试'))
    })

    // 设置较短的超时时间，确保云函数能在 3 秒内返回
    req.setTimeout(2500, () => {
      console.error('API请求超时 (2.5秒)')
      req.destroy()
      reject(new Error('AI响应超时'))
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
    // 【频率限制检查】必须放在最前面
    checkCallLimit(wxContext.OPENID)
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

    // 4. 调用 DeepSeek API（带降级处理）
    let aiReply
    try {
      aiReply = await callDeepSeekAPI(messages)
      console.log('AI回复:', aiReply)
    } catch (apiError) {
      console.error('DeepSeek API 调用失败:', apiError.message)

      // 降级方案：返回预设的简短回复
      const fallbackReplies = {
        '打招呼': '【他抬起头看向你】"嗯。"',
        '介绍自己': '【他微微颔首】"我知道。"',
        default: '【他的目光在你身上停留片刻】"继续说。"'
      }

      // 根据用户消息选择合适的降级回复
      aiReply = fallbackReplies[userMessage] || fallbackReplies.default
      console.log('使用降级回复:', aiReply)
    }

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