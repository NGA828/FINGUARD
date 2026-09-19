import * as mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
  });
  if (process.env.FRESH_DB === '1') await connection.query('DROP DATABASE IF EXISTS shield');
  await connection.query('CREATE DATABASE IF NOT EXISTS shield CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
  await connection.end();
  console.log('Shield MySQL database is ready.');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
