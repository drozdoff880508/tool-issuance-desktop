/**
 * Скрипт создания seed базы данных для портативной версии
 * Создаёт пустую базу с таблицами (без данных)
 * Эта база будет копироваться при первом запуске приложения
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Путь к seed базе
const seedDbDir = path.join(__dirname, '..', 'seed-db');
const seedDbPath = path.join(seedDbDir, 'seed.db');

console.log('=== Creating seed database for portable version ===');

// Создаём папку для seed базы
if (!fs.existsSync(seedDbDir)) {
  fs.mkdirSync(seedDbDir, { recursive: true });
  console.log('Created seed-db directory');
}

// Удаляем старую seed базу если есть
if (fs.existsSync(seedDbPath)) {
  fs.unlinkSync(seedDbPath);
  console.log('Removed old seed database');
}

// Временно создаём .env с путём к seed базе
const envPath = path.join(__dirname, '..', '.env');
const originalEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : null;

// Устанавливаем путь к seed базе
fs.writeFileSync(envPath, `DATABASE_URL=file:${seedDbPath.replace(/\\/g, '/')}\n`);
console.log('Temporary DATABASE_URL set to: file:' + seedDbPath.replace(/\\/g, '/'));

try {
  // Генерируем Prisma клиент
  console.log('Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // Запускаем миграции для создания таблиц
  console.log('Running migrations to create tables...');
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });

  // Проверяем что база создана
  if (fs.existsSync(seedDbPath)) {
    const stats = fs.statSync(seedDbPath);
    console.log(`Seed database created successfully: ${seedDbPath}`);
    console.log(`Size: ${stats.size} bytes`);
  } else {
    throw new Error('Seed database was not created');
  }

} catch (error) {
  console.error('Error creating seed database:', error.message);
  
  // Пробуем альтернативный метод - db push
  console.log('Trying alternative method (db push)...');
  try {
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
    
    if (fs.existsSync(seedDbPath)) {
      const stats = fs.statSync(seedDbPath);
      console.log(`Seed database created with db push: ${seedDbPath}`);
      console.log(`Size: ${stats.size} bytes`);
    }
  } catch (e2) {
    console.error('Alternative method also failed:', e2.message);
    process.exit(1);
  }
} finally {
  // Восстанавливаем оригинальный .env
  if (originalEnv !== null) {
    fs.writeFileSync(envPath, originalEnv);
    console.log('Restored original .env');
  }
}

console.log('=== Seed database creation complete ===');
