module.exports = {
  apps: [
    {
      name: 'aspen-backend',
      cwd: '/Users/zhilongzheng/Projects/aspen',
      script: './aspen',
      env: {
        DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY,
        JWT_SECRET: process.env.JWT_SECRET
      }
    },
    {
      name: 'aspen-frontend',
      cwd: '/Users/zhilongzheng/Projects/aspen/web',
      script: 'npm',
      args: 'run dev'
    }
  ]
}
