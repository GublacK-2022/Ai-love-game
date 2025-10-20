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
    quickActions: []
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
    this.loadChatHistory()
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

        const messages = []
        historyRes.data.forEach(item => {
          // 添加用户消息
          messages.push({
            role: 'user',
            content: item.userMessage
          })

          // 添加 AI 消息并解析
          const aiReply = item.aiReply
          messages.push({
            role: 'assistant',
            content: aiReply,
            parsedContent: parseAIMessage(aiReply) // 🎮 解析历史消息
          })
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

  // 🎮 显示开场白 - 首次进入对话时的背景叙述
  showOpeningNarration() {
    // 根据角色ID设置不同的开场白
    const openingTexts = {
      'char_001': `【这是陆氏集团的顶层办公室。落地窗外是城市的繁华景象，午后的阳光透过百叶窗在地板上投下斑驳的光影。空调的低鸣声和远处传来的电话铃声，构成了这个商业帝国心脏的日常。】

【陆景琛坐在黑色的真皮老板椅上，修长的手指正翻阅着一份财务报告。他身着深灰色的手工定制西装，领口微微敞开，露出精致的锁骨。听到敲门声，他头也不抬地开口。】

"进来。"

【他的声音低沉磁性，带着不容置疑的威严。直到你推门而入，他才缓缓抬起头，那双深邃的黑眸定定地看向你，眼神中闪过一丝难以察觉的波动。】`,

      'char_002': `【这是医学院图书馆三楼的自习区。窗外是校园里金黄的银杏树，秋日的阳光温柔地洒在书桌上。空气中弥漫着书页和淡淡的消毒水味道。】

【林清风正在认真地做笔记，他穿着白色的衬衫，戴着银色的细框眼镜。听到脚步声，他抬起头，温柔的眼神中带着友善的笑意。】

"你来了啊，要一起复习吗？"

【他轻声说着，顺手把旁边的椅子拉开，为你留出了位置。】`,

      'char_003': `【这是大学生活区的奶茶店。店内播放着轻快的音乐，空气中飘着奶茶的香甜味道。窗边的位置摆着可爱的玩偶和绿植。】

【苏宇正拿着手机拍奶茶的照片，他穿着米色的毛衣，头发有些蓬松。看到你进来，他立刻放下手机，眼睛亮晶晶地朝你挥手。】

"哇！你也来啦！快来快来~"

【他兴奋地拍着旁边的座位，笑容灿烂得像小太阳。】`
    }

    // 获取当前角色的开场白，如果没有则使用默认的
    const openingText = openingTexts[this.data.characterId] || openingTexts['char_001']

    // 解析开场白
    const parsedContent = parseAIMessage(openingText)

    // 创建开场白消息
    const openingMessage = {
      role: 'assistant',
      content: openingText,
      parsedContent: parsedContent,
      isOpening: true // 标记为开场白
    }

    this.setData({
      messages: [openingMessage],
      affection: 0
    })

    // 生成初始的快捷互动选项
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