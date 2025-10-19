// pages/character-select/character-select.js
Page({
  data: {
    characters: []
  },

  onLoad() {
    this.loadCharacters();
  },

  // 加载角色列表
  loadCharacters() {
    // 临时数据（后面会从云数据库读取）
    const characters = [
      {
        id: 'char_001',
        name: '陆景琛',
        age: 28,
        occupation: '陆氏集团总裁',
        avatar: '/images/characters/luojingchen.png', // 暂时用占位图
        tags: ['霸道总裁', '冷面温柔', '占有欲强'],
        intro: '28岁的陆氏集团总裁，外表高冷禁欲，内心细腻温柔',
        isFree: true,
        price: 0
      },
      {
        id: 'char_002',
        name: '林清风',
        age: 23,
        occupation: '医学院学长',
        avatar: '/images/characters/linqingfeng.png',
        tags: ['温柔学长', '阳光体贴', '治愈系'],
        intro: '医学院的温柔学长，阳光开朗，总是能给你温暖',
        isFree: true,
        price: 0
      },
      {
        id: 'char_003',
        name: '苏宇',
        age: 20,
        occupation: '大学生',
        avatar: '/images/characters/suyu.png',
        tags: ['邻家弟弟', '软萌可爱', '粘人精'],
        intro: '比你小两岁的邻家弟弟，软萌可爱，总是黏着你',
        isFree: true,
        price: 0
      }
    ];

    this.setData({
      characters: characters
    });
  },

  // 选择角色
  selectCharacter(e) {
    const characterId = e.currentTarget.dataset.id;
    const character = this.data.characters.find(c => c.id === characterId);

    if (!character.isFree) {
      // 付费角色，弹出提示
      wx.showModal({
        title: '解锁角色',
        content: `解锁 ${character.name} 需要支付 ¥${character.price}`,
        confirmText: '解锁',
        success: (res) => {
          if (res.confirm) {
            // TODO: 实现支付逻辑
            wx.showToast({
              title: '功能开发中',
              icon: 'none'
            });
          }
        }
      });
    } else {
      // 免费角色，直接进入对话
      wx.navigateTo({
        url: `/pages/chat/chat?characterId=${characterId}`
      });
    }
  }
});