const path = require('path')

// 自动检测运行目录（本地 Mac 或云端 Linux）
const BASE_DIR = __dirname

module.exports = {
  apps: [
    {
      name: 'aspen-backend',
      cwd: BASE_DIR,
      script: './aspen',
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY,
        JWT_SECRET: process.env.JWT_SECRET
      }
    }
  ]
}
