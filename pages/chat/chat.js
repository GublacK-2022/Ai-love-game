const db = wx.cloud.database()

Page({
  data: {
    characterId: '',
    character: {},
    messages: [],
    inputText: '',
    isThinking: false,
    affection: 0,
    scrollToView: ''
  },

  onLoad(options) {
    const { characterId, characterName } = options
    
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
          messages.push({
            role: 'user',
            content: item.userMessage
          })
          messages.push({
            role: 'assistant',
            content: item.aiReply
          })
        })

        this.setData({
          messages: messages
        })

        this.scrollToBottom()
      }
    } catch (err) {
      console.error('加载历史失败:', err)
    }
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

    if (!inputText.trim() || isThinking) {
      return
    }

    const userMessage = {
      role: 'user',
      content: inputText.trim()
    }

    this.setData({
      messages: [...messages, userMessage],
      inputText: '',
      isThinking: true
    })

    this.scrollToBottom()

    try {
      const chatHistory = messages.slice(-10).map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      const res = await wx.cloud.callFunction({
        name: 'chat',
        data: {
          characterId: characterId,
          userMessage: inputText.trim(),
          chatHistory: chatHistory
        }
      })

      console.log('云函数返回:', res)

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

        this.scrollToBottom()

        if (res.result.data.affectionChange > 0) {
          wx.showToast({
            title: `好感度 +${res.result.data.affectionChange}`,
            icon: 'none',
            duration: 1500
          })
        }
      } else {
        throw new Error(res.result.error || '发送失败')
      }

    } catch (err) {
      console.error('发送消息失败:', err)
      
      this.setData({
        isThinking: false
      })

      wx.showModal({
        title: '发送失败',
        content: err.message || '网络异常，请重试',
        showCancel: false
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
  }
})