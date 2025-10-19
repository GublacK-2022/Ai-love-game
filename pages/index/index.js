// pages/index/index.js
Page({
  data: {
    userCount: 1289 // 模拟用户数
  },

  onLoad() {
    console.log('首页加载');
  },

  // 跳转到角色选择页
  goToCharacterSelect() {
    wx.navigateTo({
      url: '/pages/character-select/character-select'
    });
  }
});