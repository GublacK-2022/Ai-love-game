// pages/character-select/character-select.js
const db = wx.cloud.database()

Page({
  data: {
    characters: []
  },

  onLoad() {
    this.loadCharacters()
  },

  // 从云数据库加载角色列表
  async loadCharacters() {
    wx.showLoading({
      title: '加载中...'
    })

    try {
      const res = await db.collection('characters').get()
      
      console.log('加载到的角色数据:', res.data) // ⭐ 添加日志
      
      this.setData({
        characters: res.data
      })
      
    } catch (err) {
      console.error('加载角色失败:', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  // 选择角色 - 修复版本
  selectCharacter(e) {
    console.log('点击事件:', e) // ⭐ 调试日志
    console.log('dataset:', e.currentTarget.dataset) // ⭐ 调试日志
    
    const characterId = e.currentTarget.dataset.id
    console.log('characterId:', characterId) // ⭐ 调试日志
    console.log('当前角色列表:', this.data.characters) // ⭐ 调试日志
    
    // ⭐ 修复：使用 _id 而不是 id 来查找
    const character = this.data.characters.find(c => c._id === characterId)
    
    console.log('找到的角色:', character) // ⭐ 调试日志

    if (!character) {
      wx.showToast({
        title: '角色数据错误',
        icon: 'none'
      })
      return
    }

    if (!character.isFree) {
      // 付费角色
      wx.showModal({
        title: '解锁角色',
        content: `解锁 ${character.name} 需要支付 ¥${character.price}`,
        confirmText: '解锁',
        success: (res) => {
          if (res.confirm) {
            wx.showToast({
              title: '功能开发中',
              icon: 'none'
            })
          }
        }
      })
    } else {
      // 免费角色，进入对话
      wx.navigateTo({
        url: `/pages/chat/chat?characterId=${characterId}&characterName=${character.name}`
      })
    }
  }
})