const db = wx.cloud.database()

/**
 * 解析 AI 消息内容，分离叙事和对话部分
 * @param {string} content - AI 返回的原始消息
 * @returns {Array} segments - 分段数组，格式：[{type: 'narrative'|'dialogue', text: '...'}]
 *
 * 示例输入：
 * "【办公室里很安静。他抬起头看着你。】"过来。"【他的眼神很温柔。】"
 *
 * 示例输出：
 * [
 *   {type: 'narrative', text: '办公室里很安静。他抬起头看着你。'},
 *   {type: 'dialogue', text: '过来。'},
 *   {type: 'narrative', text: '他的眼神很温柔。'}
 * ]
 */
function parseAIMessage(content) {
  if (!content || typeof content !== 'string') {
    return [{ type: 'dialogue', text: content || '' }]
  }

  const segments = []
  let currentIndex = 0

  // 正则匹配【】和""
  // 匹配【xxx】或"xxx"，使用非贪婪模式
  const regex = /【([^】]+)】|"([^"]+)"/g
  let match

  while ((match = regex.exec(content)) !== null) {
    // 如果匹配之前有普通文本，添加为 dialogue
    if (match.index > currentIndex) {
      const plainText = content.substring(currentIndex, match.index).trim()
      if (plainText) {
        segments.push({ type: 'dialogue', text: plainText })
      }
    }

    // 判断是叙事还是对话
    if (match[1]) {
      // 【】包裹的是叙事
      segments.push({ type: 'narrative', text: match[1].trim() })
    } else if (match[2]) {
      // ""包裹的是对话
      segments.push({ type: 'dialogue', text: match[2].trim() })
    }

    currentIndex = match.index + match[0].length
  }

  // 处理剩余的文本
  if (currentIndex < content.length) {
    const remainingText = content.substring(currentIndex).trim()
    if (remainingText) {
      segments.push({ type: 'dialogue', text: remainingText })
    }
  }

  // 如果没有解析到任何内容，返回原文作为对话
  if (segments.length === 0) {
    segments.push({ type: 'dialogue', text: content })
  }

  return segments
}

Page({
  data: {
    characterId: '',
    character: {},
    messages: [],
    inputText: '',
    isThinking: false,
    isLoading: false, // 加载对话历史的状态
    affection: 0,
    scrollToView: '',
    // 🎮 快捷互动选项（根据好感度动态生成）
    quickActions: [],
    // 🎭 场景选择器
    showSceneSelector: false,
    availableScenes: []
  },

  onLoad(options) {
    const { characterId, characterName } = options

    // 显示加载提示
    wx.showLoading({
      title: '加载中...',
      mask: true
    })

    this.setData({
      characterId: characterId
    })

    wx.setNavigationBarTitle({
      title: characterName || '对话'
    })

    this.loadCharacter()
    this.checkIfNewChat() // 🎭 检查是否新对话，决定是否显示场景选择器
  },

  // 加载角色信息
  async loadCharacter() {
    try {
      const res = await db.collection('characters').doc(this.data.characterId).get()
      this.setData({
        character: res.data
      })
    } catch (err) {
      console.error('加载角色失败:', err)
    }
  },

  // 加载对话历史
  async loadChatHistory() {
    // 设置加载状态
    this.setData({ isLoading: true })

    try {
      const sessionRes = await db.collection('chat_sessions')
        .where({
          characterId: this.data.characterId
        })
        .get()

      if (sessionRes.data.length > 0) {
        const session = sessionRes.data[0]

        this.setData({
          affection: session.affection || 0
        })

        const historyRes = await db.collection('chat_history')
          .where({
            sessionId: session._id
          })
          .orderBy('createdAt', 'asc')
          .limit(50)
          .get()

        console.log('📝 查询历史记录:', {
          sessionId: session._id,
          count: historyRes.data.length,
          data: historyRes.data
        })

        const messages = []
        historyRes.data.forEach(item => {
          // 🔥 如果是系统消息（如开场白），只显示 AI 回复，不显示用户消息
          const isSystemMessage = item.userMessage && item.userMessage.startsWith('[系统]')

          if (!isSystemMessage) {
            // 添加用户消息
            messages.push({
              role: 'user',
              content: item.userMessage
            })
          }

          // 添加 AI 消息并解析
          const aiReply = item.aiReply
          messages.push({
            role: 'assistant',
            content: aiReply,
            parsedContent: parseAIMessage(aiReply) // 🎮 解析历史消息
          })
        })

        console.log('📨 处理后的消息列表:', {
          count: messages.length,
          messages: messages
        })

        this.setData({
          messages: messages
        })

        // 🎮 根据当前好感度生成快捷互动选项
        this.generateQuickActions(session.affection || 0)

        this.scrollToBottom()
      } else {
        // 🎮 没有历史记录，显示开场白
        this.showOpeningNarration()
      }
    } catch (err) {
      console.error('加载历史失败:', err)
      // 显示错误提示
      wx.showToast({
        title: '加载历史失败',
        icon: 'none',
        duration: 2000
      })
    } finally {
      // 无论成功或失败，都要隐藏加载状态
      this.setData({ isLoading: false })
      wx.hideLoading()
    }
  },

  // 🎭 检查是否新对话
  async checkIfNewChat() {
    // 设置加载状态
    this.setData({ isLoading: true })

    try {
      const sessionRes = await db.collection('chat_sessions')
        .where({
          characterId: this.data.characterId
        })
        .get()

      if (sessionRes.data.length === 0) {
        // 新对话 - 显示场景选择器
        console.log('新对话，显示场景选择器')

        // 等待角色数据加载完成
        await this.waitForCharacter()

        this.setData({
          showSceneSelector: true,
          availableScenes: this.data.character.firstMessages || [],
          isLoading: false
        })

        wx.hideLoading()
      } else {
        // 老对话 - 直接加载历史
        console.log('已有对话记录，加载历史')
        this.setData({ showSceneSelector: false })
        this.loadChatHistory()
      }
    } catch (err) {
      console.error('检查对话状态失败:', err)
      this.setData({ isLoading: false })
      wx.hideLoading()

      // 出错时显示默认开场白
      this.showDefaultOpening()
    }
  },

  // 等待角色数据加载完成
  async waitForCharacter() {
    // 如果角色数据已加载，直接返回
    if (this.data.character && this.data.character._id) {
      return
    }

    // 等待最多 3 秒
    return new Promise((resolve) => {
      let attempts = 0
      const checkInterval = setInterval(() => {
        attempts++
        if (this.data.character && this.data.character._id) {
          clearInterval(checkInterval)
          resolve()
        } else if (attempts > 30) {
          // 超时
          clearInterval(checkInterval)
          resolve()
        }
      }, 100)
    })
  },

  // 🎭 选择场景
  async selectScene(e) {
    const sceneId = e.currentTarget.dataset.scene
    const scene = this.data.availableScenes.find(s => s.scene === sceneId)

    if (!scene) {
      console.error('场景不存在:', sceneId)
      return
    }

    console.log('选择场景:', scene.title)

    // 显示加载提示
    wx.showLoading({
      title: '进入剧情...',
      mask: true
    })

    try {
      // 🔥 重要：创建 chat_session，避免下次进入又显示场景选择器
      const sessionRes = await db.collection('chat_sessions').add({
        data: {
          characterId: this.data.characterId,
          affection: 0,
          chatCount: 0,
          selectedScene: sceneId, // 记录选择的场景
          createdAt: new Date(),
          lastChatAt: new Date()
        }
      })

      console.log('创建会话成功:', sessionRes._id)

      // 🔥 保存开场白到 chat_history，这样下次进入能看到历史记录
      await db.collection('chat_history').add({
        data: {
          sessionId: sessionRes._id,
          characterId: this.data.characterId,
          userMessage: '[系统] 选择了场景: ' + scene.title,
          aiReply: scene.content,
          createdAt: new Date()
        }
      })

      console.log('保存开场白成功')

      // 解析场景内容
      const parsedContent = parseAIMessage(scene.content)

      // 创建开场白消息
      const openingMessage = {
        role: 'assistant',
        content: scene.content,
        parsedContent: parsedContent,
        isOpening: true,
        scene: sceneId
      }

      this.setData({
        messages: [openingMessage],
        showSceneSelector: false,
        affection: 0
      })

      // 生成快捷互动选项（基于场景关键词）
      this.generateQuickActions(0)

      this.scrollToBottom()

      wx.hideLoading()

    } catch (err) {
      console.error('创建会话失败:', err)
      wx.hideLoading()

      wx.showModal({
        title: '创建对话失败',
        content: err.message || '请重试',
        showCancel: false
      })
    }
  },

  // 显示默认开场白（降级方案）
  showDefaultOpening() {
    const defaultText = '【你推开门，看到他正坐在办公桌前。】\n\n"你来了。"\n\n【他抬起头看向你。】'
    const parsedContent = parseAIMessage(defaultText)

    const openingMessage = {
      role: 'assistant',
      content: defaultText,
      parsedContent: parsedContent,
      isOpening: true
    }

    this.setData({
      messages: [openingMessage],
      affection: 0,
      showSceneSelector: false
    })

    this.generateQuickActions(0)
    this.scrollToBottom()
  },

  // 输入框变化
  onInput(e) {
    this.setData({
      inputText: e.detail.value
    })
  },

  // 发送消息
  async sendMessage() {
    const { inputText, messages, characterId, isThinking } = this.data

    // 1. 输入验证 - 检查是否为空
    if (!inputText || !inputText.trim()) {
      wx.showToast({
        title: '请输入内容',
        icon: 'none',
        duration: 1500
      })
      return
    }

    // 2. 防止重复点击 - 检查是否正在思考
    if (isThinking) {
      wx.showToast({
        title: '对方正在输入中...',
        icon: 'none',
        duration: 1500
      })
      return
    }

    const userMessage = {
      role: 'user',
      content: inputText.trim()
    }

    // 3. 更新 UI 状态
    this.setData({
      messages: [...messages, userMessage],
      inputText: '',
      isThinking: true
    })

    this.scrollToBottom()

    try {
      // 4. 准备对话历史（取最近10条）
      const chatHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      // 5. 调用云函数（设置更长的超时时间）
      const res = await wx.cloud.callFunction({
        name: 'chat',
        data: {
          characterId: characterId,
          userMessage: inputText.trim(),
          chatHistory: chatHistory
        },
        timeout: 20000  // 设置 20 秒超时
      })

      console.log('云函数返回:', res)

      // 6. 处理云函数返回结果
      if (res.result && res.result.success) {
        const rawReply = res.result.data.reply

        // 🎮 解析 AI 消息，分离叙事和对话
        const parsedContent = parseAIMessage(rawReply)

        const aiMessage = {
          role: 'assistant',
          content: rawReply,           // 原始内容，用于保存历史
          parsedContent: parsedContent  // 解析后的分段内容，用于显示
        }

        this.setData({
          messages: [...this.data.messages, aiMessage],
          affection: res.result.data.affection
        })

        this.scrollToBottom()

        // 显示好感度变化提示
        if (res.result.data.affectionChange > 0) {
          wx.showToast({
            title: `好感度 +${res.result.data.affectionChange}`,
            icon: 'none',
            duration: 1500
          })
        }

        // 🎮 根据好感度生成新的快捷互动选项
        this.generateQuickActions(res.result.data.affection)
      } else {
        // 云函数返回失败
        throw new Error(res.result?.error || '发送失败，请重试')
      }

    } catch (err) {
      console.error('发送消息失败:', err)

      // 7. 完整的错误处理
      let errorMsg = '网络异常，请检查网络后重试'
      let errorTitle = '发送失败'

      // 根据不同错误类型显示不同提示
      if (err.errMsg && err.errMsg.includes('timeout')) {
        errorTitle = 'AI 思考超时'
        errorMsg = 'AI 正在努力思考中，响应时间较长。\n\n建议：\n1. 稍后重试\n2. 简化问题内容\n3. 检查网络连接'
      } else if (err.errMsg && err.errMsg.includes('TIME_LIMIT_EXCEEDED')) {
        errorTitle = '云函数超时'
        errorMsg = 'AI 思考时间过长导致超时。\n\n已为您优化配置，请重新上传云函数后再试。'
      } else if (err.errMsg && err.errMsg.includes('fail')) {
        errorMsg = '网络连接失败，请检查网络设置'
      } else if (err.message) {
        errorMsg = err.message
      }

      // 显示详细错误对话框
      wx.showModal({
        title: errorTitle,
        content: errorMsg,
        showCancel: true,
        cancelText: '取消',
        confirmText: '重试',
        success: (res) => {
          if (res.confirm) {
            // 用户点击重试，恢复输入内容
            this.setData({
              inputText: userMessage.content,
              messages: messages // 恢复到发送前的消息列表
            })
          }
        }
      })

    } finally {
      // 8. 确保在 finally 块中重置状态
      this.setData({
        isThinking: false
      })
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
  },

  // 🎮 根据好感度生成快捷互动选项
  generateQuickActions(affection) {
    let actions = []

    if (affection < 20) {
      // 陌生人阶段：礼貌试探
      actions = [
        '打招呼',
        '介绍自己',
        '询问他在做什么',
        '夸奖他的办公室',
        '请教工作问题',
        '礼貌告辞'
      ]
    } else if (affection < 40) {
      // 熟人阶段：日常交流
      actions = [
        '关心他最近忙吗',
        '邀请他喝咖啡',
        '聊聊天气',
        '问他午餐吃什么',
        '分享有趣的事',
        '询问他的兴趣'
      ]
    } else if (affection < 60) {
      // 朋友阶段：亲近互动
      actions = [
        '主动靠近他',
        '开个玩笑',
        '说想他了',
        '邀请他一起吃饭',
        '问他有没有空',
        '聊聊私人话题'
      ]
    } else if (affection < 80) {
      // 暧昧阶段：亲密试探
      actions = [
        '轻轻拉他的衣角',
        '盯着他看',
        '撒娇说累了',
        '靠在他肩膀上',
        '问他喜欢什么类型',
        '暗示想和他单独相处'
      ]
    } else {
      // 热恋阶段：甜蜜互动
      actions = [
        '抱住他',
        '亲吻他的脸颊',
        '说爱他',
        '撒娇要抱抱',
        '问他想不想我',
        '提议一起做点什么'
      ]
    }

    this.setData({
      quickActions: actions
    })
  },

  // 选择快捷互动选项
  selectQuickAction(e) {
    const text = e.currentTarget.dataset.text

    // 防御性检查
    if (!text) {
      console.error('快捷选项文本为空')
      return
    }

    console.log('选择快捷选项:', text)

    // 填充到输入框，让用户可以修改
    this.setData({
      inputText: text
    })
  }
})