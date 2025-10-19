# 代码结构文档

## 全局文件

### app.js - 小程序入口
```javascript
// 主要功能：
// 1. 初始化云开发环境
// 2. 设置全局数据

App({
  onLaunch() {
    // 初始化云开发
    wx.cloud.init({
      env: 'ai-love-game-xxxxx', // 云环境ID
      traceUser: true
    })
  },
  globalData: {
    userInfo: null
  }
})
```

### app.json - 全局配置
```json
{
  "pages": [
    "pages/index/index",              // 首页
    "pages/character-select/character-select",  // 角色选择
    "pages/chat/chat"                 // 对话页面
  ],
  "window": {
    "navigationBarBackgroundColor": "#ffffff",
    "navigationBarTitleText": "AI恋爱养成",
    "navigationBarTextStyle": "black",
    "backgroundColor": "#f8f8f8"
  },
  "cloudfunctionRoot": "cloudfunctions/"  // 云函数根目录
}
```

### app.wxss - 全局样式
```css
/* 主要定义：
 * 1. 通用容器样式
 * 2. 主色调定义
 * 3. 按钮样式
 * 4. 卡片样式
 */
```

---

## 页面文件

### pages/index/ - 首页

#### index.js
```javascript
Page({
  data: {
    userCount: 1289  // 模拟用户数
  },
  
  // 跳转到角色选择页
  goToCharacterSelect() {
    wx.navigateTo({
      url: '/pages/character-select/character-select'
    })
  }
})
```

#### index.wxml
```xml
<!-- 页面结构：
  1. 欢迎区域（Logo + 标题）
  2. 功能介绍（3个特色）
  3. 开始按钮
-->
```

#### index.wxss
```css
/* 样式特点：
 * - 渐变背景（紫色）
 * - 居中布局
 * - 响应式设计
 */
```

---

### pages/character-select/ - 角色选择页

#### character-select.js
```javascript
const db = wx.cloud.database()

Page({
  data: {
    characters: []  // 角色列表
  },

  onLoad() {
    this.loadCharacters()
  },

  // 从云数据库加载角色
  async loadCharacters() {
    const res = await db.collection('characters').get()
    this.setData({
      characters: res.data
    })
  },

  // 选择角色，跳转到对话页
  selectCharacter(e) {
    const characterId = e.currentTarget.dataset.id
    const character = this.data.characters.find(c => c._id === characterId)
    
    if (character.isFree) {
      wx.navigateTo({
        url: `/pages/chat/chat?characterId=${characterId}&characterName=${character.name}`
      })
    } else {
      // 显示付费提示
      wx.showModal({...})
    }
  }
})
```

#### 数据流
```
云数据库 characters
    ↓
loadCharacters()
    ↓
setData({characters})
    ↓
页面渲染角色卡片
    ↓
用户点击
    ↓
selectCharacter()
    ↓
跳转到对话页
```

---

### pages/chat/ - 对话页面

#### chat.js - 核心逻辑
```javascript
const db = wx.cloud.database()

Page({
  data: {
    characterId: '',      // 角色ID
    character: {},        // 角色信息
    messages: [],         // 消息列表
    inputText: '',        // 输入框内容
    isThinking: false,    // AI是否在思考
    affection: 0,         // 好感度
    scrollToView: ''      // 滚动位置
  },

  onLoad(options) {
    // 1. 获取页面参数
    this.setData({
      characterId: options.characterId
    })
    
    // 2. 加载角色信息
    this.loadCharacter()
    
    // 3. 加载历史对话
    this.loadChatHistory()
  },

  // 加载角色信息
  async loadCharacter() {
    const res = await db.collection('characters')
      .doc(this.data.characterId)
      .get()
    this.setData({
      character: res.data
    })
  },

  // 加载对话历史
  async loadChatHistory() {
    // 1. 查找会话
    const sessionRes = await db.collection('chat_sessions')
      .where({
        characterId: this.data.characterId
      })
      .get()

    if (sessionRes.data.length > 0) {
      const session = sessionRes.data[0]
      
      // 2. 更新好感度
      this.setData({
        affection: session.affection
      })

      // 3. 加载历史消息
      const historyRes = await db.collection('chat_history')
        .where({
          sessionId: session._id
        })
        .orderBy('createdAt', 'asc')
        .limit(50)
        .get()

      // 4. 转换为消息格式
      const messages = []
      historyRes.data.forEach(item => {
        messages.push({ role: 'user', content: item.userMessage })
        messages.push({ role: 'assistant', content: item.aiReply })
      })

      this.setData({ messages })
    }
  },

  // 发送消息 - 核心函数
  async sendMessage() {
    const { inputText, messages, characterId } = this.data

    if (!inputText.trim()) return

    // 1. 添加用户消息到界面
    const userMessage = {
      role: 'user',
      content: inputText.trim()
    }
    this.setData({
      messages: [...messages, userMessage],
      inputText: '',
      isThinking: true
    })

    // 2. 准备对话历史（只传最近10条）
    const chatHistory = messages.slice(-10).map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    try {
      // 3. 调用云函数
      const res = await wx.cloud.callFunction({
        name: 'chat',
        data: {
          characterId: characterId,
          userMessage: inputText.trim(),
          chatHistory: chatHistory
        }
      })

      // 4. 显示AI回复
      if (res.result.success) {
        const aiMessage = {
          role: 'assistant',
          content: res.result.data.reply
        }
        this.setData({
          messages: [...this.data.messages, aiMessage],
          affection: res.result.data.affection,
          isThinking: false
        })

        // 5. 显示好感度提示
        if (res.result.data.affectionChange > 0) {
          wx.showToast({
            title: `好感度 +${res.result.data.affectionChange}`,
            icon: 'none'
          })
        }
      }
    } catch (err) {
      console.error('发送失败:', err)
      this.setData({ isThinking: false })
    }
  },

  // 滚动到底部
  scrollToBottom() {
    setTimeout(() => {
      const lastIndex = this.data.messages.length - 1
      this.setData({
        scrollToView: `msg-${lastIndex}`
      })
    }, 100)
  }
})
```

#### 数据流程图
```
用户输入
    ↓
sendMessage()
    ↓
添加用户消息到界面
    ↓
调用云函数 chat
    ↓
云函数处理
  ├─ 查询/创建会话
  ├─ 调用DeepSeek API
  ├─ 计算好感度
  ├─ 保存到数据库
  └─ 返回结果
    ↓
显示AI回复
    ↓
更新好感度
    ↓
滚动到底部
```

---

## 云函数

### cloudfunctions/chat/index.js

#### 主要功能
1. 接收用户消息
2. 管理对话会话
3. 调用DeepSeek API
4. 计算好感度
5. 保存对话记录

#### 代码结构
```javascript
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

// DeepSeek API Key
const DEEPSEEK_API_KEY = 'sk-...'

// 系统提示词（不同角色）
const SYSTEM_PROMPTS = {
  'char_001': '陆景琛的提示词...',
  'char_002': '林清风的提示词...',
  'char_003': '苏宇的提示词...'
}

// 好感度阶段判断
function getAffectionStage(affection) {
  if (affection < 20) return '陌生阶段'
  if (affection < 40) return '熟人阶段'
  if (affection < 60) return '朋友阶段'
  if (affection < 80) return '暧昧阶段'
  return '热恋阶段'
}

// DeepSeek API 调用
async function callDeepSeekAPI(messages) {
  return new Promise((resolve, reject) => {
    const https = require('https')
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
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        const result = JSON.parse(data)
        resolve(result.choices[0].message.content)
      })
    })

    req.on('error', reject)
    req.write(postData)
    req.end()
  })
}

// 云函数主入口
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { characterId, userMessage, chatHistory } = event

  // 1. 查询或创建会话
  const sessionResult = await db.collection('chat_sessions')
    .where({
      userId: wxContext.OPENID,
      characterId: characterId
    })
    .get()

  let session
  if (sessionResult.data.length === 0) {
    // 创建新会话
    const addResult = await db.collection('chat_sessions').add({
      data: {
        userId: wxContext.OPENID,
        characterId: characterId,
        affection: 0,
        chatCount: 0,
        createdAt: new Date()
      }
    })
    session = { _id: addResult._id, affection: 0 }
  } else {
    session = sessionResult.data[0]
  }

  // 2. 构建提示词
  const affectionStage = getAffectionStage(session.affection)
  const systemPrompt = SYSTEM_PROMPTS[characterId]
    .replace('{affectionStage}', affectionStage)

  // 3. 准备消息
  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory.slice(-10),
    { role: 'user', content: userMessage }
  ]

  // 4. 调用 DeepSeek API
  const aiReply = await callDeepSeekAPI(messages)

  // 5. 计算好感度变化
  let affectionChange = 2  // 默认+2
  const positiveWords = ['喜欢', '谢谢', '开心']
  const negativeWords = ['讨厌', '烦', '不要']
  
  if (positiveWords.some(w => userMessage.includes(w))) {
    affectionChange = 5
  } else if (negativeWords.some(w => userMessage.includes(w))) {
    affectionChange = -5
  }

  const newAffection = Math.max(0, Math.min(100, 
    session.affection + affectionChange
  ))

  // 6. 更新会话
  await db.collection('chat_sessions').doc(session._id).update({
    data: {
      affection: newAffection,
      chatCount: db.command.inc(1),
      lastChatAt: new Date()
    }
  })

  // 7. 保存对话记录
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

  // 8. 返回结果
  return {
    success: true,
    data: {
      reply: aiReply,
      affection: newAffection,
      affectionChange: affectionChange
    }
  }
}
```

#### 执行流程
```
小程序调用云函数
    ↓
获取用户OpenID
    ↓
查询/创建会话 (chat_sessions)
    ↓
获取当前好感度
    ↓
构建System Prompt
    ↓
调用DeepSeek API
    ↓
计算好感度变化
    ↓
更新会话数据
    ↓
保存对话记录 (chat_history)
    ↓
返回AI回复和新好感度
    ↓
小程序显示结果
```

---

## 数据库设计

### characters - 角色表
```javascript
{
  _id: "char_001",          // 主键
  name: "陆景琛",
  age: 28,
  occupation: "陆氏集团总裁",
  avatar: "/images/...",
  tags: ["霸道总裁", "冷面温柔"],
  intro: "简介...",
  isFree: true,
  price: 0
}
```

### chat_sessions - 会话表
```javascript
{
  _id: "自动生成",
  userId: "用户OpenID",
  characterId: "char_001",
  affection: 15,            // 当前好感度
  chatCount: 23,            // 对话次数
  createdAt: Date,
  lastChatAt: Date
}
```

### chat_history - 对话记录表
```javascript
{
  _id: "自动生成",
  sessionId: "会话ID",
  userId: "用户OpenID",
  characterId: "char_001",
  userMessage: "用户说的话",
  aiReply: "AI回复",
  affectionChange: 2,       // 本次好感度变化
  createdAt: Date
}
```

---

## 关键算法

### 好感度计算算法
```javascript
function calculateAffection(userMessage, currentAffection) {
  let change = 2  // 基础值

  // 正面词汇
  const positiveWords = ['喜欢', '开心', '谢谢', '好的', '爱你']
  if (positiveWords.some(word => userMessage.includes(word))) {
    change = 5
  }

  // 负面词汇
  const negativeWords = ['讨厌', '烦', '不要', '滚']
  if (negativeWords.some(word => userMessage.includes(word))) {
    change = -5
  }

  // 限制在 0-100 范围
  const newAffection = Math.max(0, Math.min(100, 
    currentAffection + change
  ))

  return {
    newAffection: newAffection,
    change: change
  }
}
```

### 提示词动态生成
```javascript
function buildSystemPrompt(characterId, affection) {
  // 1. 获取基础模板
  const template = SYSTEM_PROMPTS[characterId]

  // 2. 根据好感度生成阶段描述
  const stage = getAffectionStage(affection)

  // 3. 替换变量
  return template.replace('{affectionStage}', stage)
}

### 消息历史管理
```javascript
function prepareMessageHistory(allMessages, limit = 10) {
  // 只保留最近的消息
  const recentMessages = allMessages.slice(-limit)
  
  // 转换为API需要的格式
  return recentMessages.map(msg => ({
    role: msg.role,
    content: msg.content
  }))
}
```

---

## 常用工具函数

### 时间格式化
```javascript
function formatTime(date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()

  return `${year}-${month}-${day} ${hour}:${minute}`
}
```

### 文本截断
```javascript
function truncateText(text, maxLength = 50) {
  if (text.length <= maxLength) {
    return text
  }
  return text.substring(0, maxLength) + '...'
}
```

---

## 样式系统

### 颜色变量（app.wxss）
```css
:root {
  /* 主色调 */
  --primary-color: #667eea;
  --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  
  /* 背景色 */
  --bg-color: #f8f8f8;
  --card-bg: #ffffff;
  
  /* 文字颜色 */
  --text-primary: #1a1a1a;
  --text-secondary: #8e8e93;
  --text-tertiary: #c3c3c3;
  
  /* 边框 */
  --border-color: #f0f0f0;
  
  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  
  /* 圆角 */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
}
```

### 响应式布局
```css
/* 小屏幕适配 */
@media screen and (max-width: 375px) {
  .container {
    padding: 12px;
  }
  
  .character-card {
    padding: 12px;
  }
}

/* 大屏幕适配 */
@media screen and (min-width: 768px) {
  .container {
    max-width: 600px;
    margin: 0 auto;
  }
}
```

---

## 错误处理机制

### 云函数错误处理
```javascript
exports.main = async (event, context) => {
  try {
    // 主要逻辑
    const result = await processChat(event)
    return {
      success: true,
      data: result
    }
  } catch (error) {
    console.error('云函数错误:', error)
    
    // 返回友好的错误信息
    return {
      success: false,
      error: getErrorMessage(error)
    }
  }
}

function getErrorMessage(error) {
  if (error.message.includes('timeout')) {
    return 'AI响应超时，请重试'
  }
  if (error.message.includes('balance')) {
    return 'API余额不足'
  }
  return '服务异常，请稍后重试'
}
```

### 小程序错误处理
```javascript
async sendMessage() {
  try {
    const res = await wx.cloud.callFunction({
      name: 'chat',
      data: {...}
    })
    
    if (res.result.success) {
      // 成功处理
    } else {
      // 业务错误
      throw new Error(res.result.error)
    }
  } catch (err) {
    // 显示错误提示
    wx.showModal({
      title: '发送失败',
      content: err.message || '网络异常',
      showCancel: false
    })
  }
}
```

---

## 性能优化策略

### 1. 数据库查询优化
```javascript
// ❌ 不好的做法：多次查询
const character = await db.collection('characters').doc(id).get()
const session = await db.collection('chat_sessions').where({...}).get()
const history = await db.collection('chat_history').where({...}).get()

// ✅ 好的做法：合并查询
const [character, session, history] = await Promise.all([
  db.collection('characters').doc(id).get(),
  db.collection('chat_sessions').where({...}).get(),
  db.collection('chat_history').where({...}).get()
])
```

### 2. 消息列表优化
```javascript
// 虚拟列表（当消息超过100条时）
data: {
  messages: [],
  displayMessages: []  // 只显示可见的消息
}

// 只渲染可见区域的消息
updateDisplayMessages() {
  const start = Math.max(0, this.data.messages.length - 50)
  this.setData({
    displayMessages: this.data.messages.slice(start)
  })
}
```

### 3. 图片懒加载
```xml
<image 
  src="{{item.avatar}}" 
  mode="aspectFill"
  lazy-load="{{true}}"
/>
```

### 4. 防抖处理
```javascript
// 输入框防抖
let inputTimer = null
onInput(e) {
  clearTimeout(inputTimer)
  inputTimer = setTimeout(() => {
    this.setData({
      inputText: e.detail.value
    })
  }, 300)
}
```

---

## 安全措施

### 1. API Key 保护
```javascript
// ✅ API Key 只存储在云函数中
// ❌ 永远不要把 API Key 放在小程序代码中

// cloudfunctions/chat/index.js
const DEEPSEEK_API_KEY = process.env.API_KEY || 'sk-...'
```

### 2. 输入验证
```javascript
// 云函数中验证输入
function validateInput(userMessage) {
  // 长度限制
  if (userMessage.length > 500) {
    throw new Error('消息过长')
  }
  
  // 敏感词过滤
  const sensitiveWords = ['政治', '暴力', '色情']
  if (sensitiveWords.some(word => userMessage.includes(word))) {
    throw new Error('消息包含敏感内容')
  }
  
  return true
}
```

### 3. 频率限制
```javascript
// 限制用户调用频率
const userCallCount = {}

function checkRateLimit(userId) {
  const now = Date.now()
  const userCalls = userCallCount[userId] || []
  
  // 清除1分钟前的记录
  userCallCount[userId] = userCalls.filter(time => now - time < 60000)
  
  // 限制每分钟10次
  if (userCallCount[userId].length >= 10) {
    throw new Error('请求过于频繁，请稍后再试')
  }
  
  userCallCount[userId].push(now)
}
```

### 4. 数据权限
```javascript
// 确保用户只能访问自己的数据
const session = await db.collection('chat_sessions')
  .where({
    userId: wxContext.OPENID,  // 必须匹配当前用户
    characterId: characterId
  })
  .get()
```

---

## 调试技巧

### 1. 云函数调试
```javascript
// 在关键位置添加日志
console.log('步骤1: 收到请求', event)
console.log('步骤2: 查询会话', session)
console.log('步骤3: AI回复', aiReply)

// 云开发控制台 → 云函数 → 日志 查看输出
```

### 2. 小程序调试
```javascript
// 使用 console.log 追踪数据流
console.log('发送消息:', inputText)
console.log('云函数返回:', res)
console.log('当前好感度:', this.data.affection)

// 开发者工具 → Console 查看输出
```

### 3. 网络请求调试
```javascript
// 查看云函数调用详情
wx.cloud.callFunction({
  name: 'chat',
  data: {...},
  success: res => {
    console.log('成功:', res)
  },
  fail: err => {
    console.error('失败:', err)
  },
  complete: () => {
    console.log('完成')
  }
})

// 开发者工具 → Network 查看请求详情
```

---

## 部署流程

### 1. 云函数部署
```bash
# 方式1: 通过微信开发者工具
右键 cloudfunctions/chat → 上传并部署：云端安装依赖

# 方式2: 通过命令行（需要安装 CLI）
wx-server-sdk deploy chat

# 方式3: 通过网页控制台
访问 console.cloud.tencent.com → 云函数 → 手动上传代码
```

### 2. 数据库初始化
```javascript
// 在云开发控制台执行
// 数据库 → characters → 导入数据

// 或使用云函数初始化
exports.main = async () => {
  const db = cloud.database()
  
  await db.collection('characters').add({
    data: {
      _id: 'char_001',
      name: '陆景琛',
      // ... 其他字段
    }
  })
  
  return { success: true }
}
```

### 3. 小程序发布
```bash
1. 微信开发者工具 → 上传代码
2. 填写版本号和备注
3. 登录小程序后台 mp.weixin.qq.com
4. 提交审核
5. 审核通过后发布
```

---

## 测试用例

### 1. 功能测试
```javascript
// 测试场景1: 正常对话
用户输入: "你好"
预期输出: AI回复符合角色人设，好感度+2

// 测试场景2: 正面词汇
用户输入: "我很喜欢你"
预期输出: AI回复温柔，好感度+5

// 测试场景3: 负面词汇
用户输入: "你真烦"
预期输出: AI回复冷淡，好感度-5

// 测试场景4: 对话历史
操作: 退出后重新进入
预期: 显示历史消息，好感度保持
```

### 2. 边界测试
```javascript
// 测试1: 空消息
输入: ""
预期: 不发送，提示"请输入内容"

// 测试2: 超长消息
输入: 500字以上
预期: 提示"消息过长"

// 测试3: 快速连续点击
操作: 快速点击发送10次
预期: 显示"请求过于频繁"
```

### 3. 性能测试
```javascript
// 测试1: 响应时间
操作: 发送消息
指标: AI回复时间 < 5秒

// 测试2: 并发测试
操作: 10个用户同时发消息
预期: 全部成功，无崩溃

// 测试3: 长时间运行
操作: 连续对话50轮
预期: 无内存泄漏，运行正常
```

---

## 常见问题 FAQ

### Q1: 云函数调用失败？
```
检查：
1. 云函数是否成功部署
2. 环境ID是否正确
3. 网络是否正常
4. API Key是否有效
```

### Q2: AI回复质量不好？
```
优化：
1. 调整 System Prompt
2. 增加示例对话
3. 调整 temperature 参数
4. 限制回复长度
```

### Q3: 好感度不变化？
```
检查：
1. 云函数是否正确计算
2. 数据库是否正确更新
3. 页面是否正确显示
```

### Q4: 消息不显示？
```
检查：
1. messages 数组是否更新
2. scroll-view 是否滚动
3. WXML 渲染是否正常
```

---

## 代码规范

### 命名规范
```javascript
// 变量：小驼峰
let userName = 'test'
let characterId = 'char_001'

// 常量：大写下划线
const API_KEY = 'sk-...'
const MAX_MESSAGE_LENGTH = 500

// 函数：小驼峰，动词开头
function loadCharacter() {}
function sendMessage() {}
function calculateAffection() {}

// 类/组件：大驼峰
class ChatManager {}
Component({...})

// 文件名：短横线
character-select.js
chat-history.js
```

### 注释规范
```javascript
/**
 * 发送消息到AI
 * @param {string} userMessage - 用户输入的消息
 * @param {Array} chatHistory - 对话历史
 * @returns {Promise<Object>} AI回复结果
 */
async function sendMessage(userMessage, chatHistory) {
  // 1. 验证输入
  validateInput(userMessage)
  
  // 2. 调用API
  const result = await callAPI(userMessage, chatHistory)
  
  // 3. 返回结果
  return result
}
```

### 错误处理规范
```javascript
// ✅ 好的做法
try {
  const result = await someAsyncFunction()
  return { success: true, data: result }
} catch (error) {
  console.error('操作失败:', error)
  return { success: false, error: error.message }
}

// ❌ 不好的做法
const result = await someAsyncFunction()  // 没有错误处理
```

---

## Git 工作流

### 分支管理
```bash
main      # 主分支（生产环境）
├── dev   # 开发分支
    ├── feature/快捷回复
    ├── feature/剧情事件
    └── fix/对话bug
```

### 提交规范
```bash
# 格式：<type>: <subject>

feat: 添加快捷回复功能
fix: 修复好感度计算错误
docs: 更新README文档
style: 调整UI样式
refactor: 重构云函数代码
test: 添加单元测试
chore: 更新依赖包
```

### 常用命令
```bash
# 创建功能分支
git checkout -b feature/快捷回复

# 提交代码
git add .
git commit -m "feat: 添加快捷回复功能"

# 合并到dev
git checkout dev
git merge feature/快捷回复

# 推送到远程
git push origin dev
```

---

## 最后更新

**文档版本：** v1.0  
**更新日期：** 2025年10月20日  
**维护者：** GublacK-2022

---

## 附录：快速参考

### 关键文件位置
```
核心逻辑：
- 云函数: cloudfunctions/chat/index.js
- 对话页: pages/chat/chat.js
- 角色选择: pages/character-select/character-select.js

配置文件：
- 全局配置: app.json
- 项目配置: project.config.json
- 云函数配置: cloudfunctions/chat/package.json

文档：
- 项目总结: docs/项目总结.md
- 角色设定: docs/角色设定.md
- 数据库设计: docs/数据库设计.md
```

### 常用API
```javascript
// 云开发
wx.cloud.init()
wx.cloud.callFunction()
wx.cloud.database()

// 页面路由
wx.navigateTo()
wx.redirectTo()
wx.switchTab()

// UI交互
wx.showToast()
wx.showModal()
wx.showLoading()

// 存储
wx.setStorageSync()
wx.getStorageSync()
```
