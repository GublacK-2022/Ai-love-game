// pages/index/index.js
Page({
  data: {

  },

  onLoad() {
    console.log('首页加载');
  },

  // 跳转到角色选择页
  goToCharacterSelect() {
    wx.navigateTo({
      url: '/pages/character-select/character-select'
    });
  },

  // 跳转到隐私政策页
  goToPrivacy() {
    wx.navigateTo({
      url: '/pages/privacy/privacy?from=index'
    });
  }
});