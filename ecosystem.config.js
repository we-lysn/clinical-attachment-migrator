module.exports = {
  apps: [
    {
      name: 'clinical-attachment-migrator',
      script: './dist/index.js',
      instances: 1,
      autorestart: false, // Don't restart since this runs once and exits
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    }
  ]
};
