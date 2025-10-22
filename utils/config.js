// utils/config.js
// 全局配置文件

// 🐛 调试模式（生产环境请设为 false）
const DEBUG_MODE = true

// 封装的日志函数
const logger = {
  log: (...args) => {
    if (DEBUG_MODE) {
      console.log(...args)
    }
  },

  warn: (...args) => {
    if (DEBUG_MODE) {
      console.warn(...args)
    }
  },

  error: (...args) => {
    // 错误日志始终输出
    console.error(...args)
  },

  info: (...args) => {
    if (DEBUG_MODE) {
      console.info(...args)
    }
  }
}

module.exports = {
  DEBUG_MODE,
  logger
}
