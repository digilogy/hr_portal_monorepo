/**
  PM2 Ecosystem Configuration for HR Portal Backend & Workers
  Usage:
    pm2 start ecosystem.config.cjs
    pm2 start ecosystem.config.cjs --env production
    pm2 status
    pm2 logs
*/

module.exports = {
  apps: [
    {
      name: "hr-api",
      script: "./src/index.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      env: {
        NODE_ENV: "development",
        PORT: 5111,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 5111,
      },
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      error_file: "./reports/logs/api-error.log",
      out_file: "./reports/logs/api-out.log",
      merge_logs: true,
    },
    {
      name: "hr-mail-worker",
      script: "./src/workers/mail.worker.ts",
      interpreter: "node",
      interpreter_args: "-r ts-node/register",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
      instances: 2, // Scale background mail queue consumers across CPUs
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      error_file: "./reports/logs/worker-error.log",
      out_file: "./reports/logs/worker-out.log",
      merge_logs: true,
    },
  ],
};
