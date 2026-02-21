module.exports = {
  apps: [
    {
      name: 'aspen-backend',
      script: './aspen',
      cwd: __dirname, // 使用当前目录（配置文件所在目录）
      interpreter: 'none', // 不使用解释器，直接执行二进制文件
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true
    }
  ]
};
