// pages/privacy/privacy.js
Page({
  data: {

  },

  onLoad(options) {
    // 记录来源页面，方便返回
    this.fromPage = options.from || 'index'
  },

  // 用户点击同意
  onAgree() {
    // 保存用户已同意隐私政策
    wx.setStorageSync('privacy_agreed', true)
    wx.setStorageSync('privacy_agreed_time', new Date().toISOString())

    wx.showToast({
      title: '感谢您的信任',
      icon: 'success',
      duration: 1500
    })

    // 返回到来源页面或首页
    setTimeout(() => {
      if (this.fromPage === 'index') {
        wx.reLaunch({
          url: '/pages/index/index'
        })
      } else {
        wx.navigateBack()
      }
    }, 1500)
  }
})
