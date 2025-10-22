// utils/user.js
// 用户信息工具函数

let cachedOpenId = null

/**
 * 获取用户 OpenID
 * @returns {Promise<string>} 用户的 OpenID
 */
async function getOpenId() {
  // 如果已经缓存，直接返回
  if (cachedOpenId) {
    return cachedOpenId
  }

  try {
    // 调用云函数获取 OpenID
    const res = await wx.cloud.callFunction({
      name: 'login'
    })

    if (res.result && res.result.openid) {
      cachedOpenId = res.result.openid
      return cachedOpenId
    }

    throw new Error('获取 OpenID 失败')
  } catch (err) {
    console.error('获取 OpenID 失败:', err)
    throw err
  }
}

/**
 * 清除缓存的 OpenID（用于登出等场景）
 */
function clearOpenId() {
  cachedOpenId = null
}

module.exports = {
  getOpenId,
  clearOpenId
}
