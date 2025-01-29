module.exports = {
  apps: [
    {
      name: "space-combat-server",
      script: "./dist/main.js",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
        PORT: 8888,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 8888,
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      error_file: "logs/error.log",
      out_file: "logs/out.log",
      merge_logs: true,
    },
  ],
};
