// PM2 untuk server demo (brs.kecup.in): API NestJS (:3610) & web Next.js standalone (:3611), keduanya hanya di 127.0.0.1 (lewat nginx).
// Mode cluster 2 proses per aplikasi: `pm2 reload` mengganti proses satu per satu sehingga tidak ada jeda saat deploy.
// Aman karena tugas latar (agregat, antrean ekspor) memakai kunci di database dan event Monitoring lewat Postgres LISTEN/NOTIFY.
// Rilis aktif dipilih lewat symlink backend/dist dan web/.next/standalone (lihat infra/scripts/deploy-demo.sh).
const ROOT = '/var/www/_demo-project/lapor-bhabinkamtibmas';
const common = { exec_mode: 'cluster', instances: 2, kill_timeout: 8000, listen_timeout: 15000 };

module.exports = {
  apps: [
    { ...common, name: 'lapor-brs-api', cwd: `${ROOT}/backend`, script: 'dist/main.js', max_memory_restart: '1G',
      env: { NODE_ENV: 'production', HOST: '127.0.0.1', UV_THREADPOOL_SIZE: '8' } },
    { ...common, name: 'lapor-brs-web', cwd: `${ROOT}/web/.next/standalone`, script: 'server.js', max_memory_restart: '768M',
      env: { NODE_ENV: 'production', PORT: '3611', HOSTNAME: '127.0.0.1', API_URL: 'http://127.0.0.1:3610/api/v1', DEV_LOGIN: 'true' } },
  ],
};
