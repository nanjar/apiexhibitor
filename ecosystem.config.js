module.exports = {
  apps: [
    {
      name: 'apiexhibitor',
      script: 'dist/main.js',
      cwd: __dirname,
      instances: 1,
      // WAJIB fork, bukan cluster - konsisten dengan prinsip project ini
      // (apilabvisitor & visitor-app-backend juga fork mode). Kalaupun
      // apiexhibitor belum punya cron sendiri sekarang, tetap fork supaya
      // konsisten dan aman kalau nanti ditambah scheduled job.
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
