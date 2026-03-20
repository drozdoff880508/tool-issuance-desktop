const fs = require('fs');
const path = require('path');

// Создаём папку build-output
const buildDir = path.join(__dirname, '..', 'build-output');
const standaloneDir = path.join(__dirname, '..', '.next', 'standalone');

console.log('=== Copying files for Electron build ===');
console.log('Build dir:', buildDir);
console.log('Standalone dir:', standaloneDir);

// Удаляем старую папку если есть
if (fs.existsSync(buildDir)) {
  fs.rmSync(buildDir, { recursive: true });
}

// Копируем standalone
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Copying .next/standalone...');
copyDir(standaloneDir, buildDir);

// Копируем static файлы
console.log('Copying .next/static...');
const staticSrc = path.join(__dirname, '..', '.next', 'static');
const staticDest = path.join(buildDir, '.next', 'static');
if (fs.existsSync(staticSrc)) {
  copyDir(staticSrc, staticDest);
}

// Копируем public
console.log('Copying public...');
const publicSrc = path.join(__dirname, '..', 'public');
const publicDest = path.join(buildDir, 'public');
if (fs.existsSync(publicSrc)) {
  copyDir(publicSrc, publicDest);
}

// Копируем prisma
console.log('Copying prisma...');
const prismaSrc = path.join(__dirname, '..', 'prisma');
const prismaDest = path.join(buildDir, 'prisma');
if (fs.existsSync(prismaSrc)) {
  copyDir(prismaSrc, prismaDest);
}

// Копируем db
console.log('Copying db...');
const dbSrc = path.join(__dirname, '..', 'db');
const dbDest = path.join(buildDir, 'db');
if (fs.existsSync(dbSrc)) {
  copyDir(dbSrc, dbDest);
}

// Копируем .env
console.log('Copying .env...');
const envSrc = path.join(__dirname, '..', '.env');
const envDest = path.join(buildDir, '.env');
if (fs.existsSync(envSrc)) {
  fs.copyFileSync(envSrc, envDest);
}

// Копируем Prisma engines из node_modules
console.log('Copying Prisma engines...');
const prismaEnginesSrc = path.join(__dirname, '..', 'node_modules', '@prisma', 'engines');
const prismaEnginesDest = path.join(buildDir, 'node_modules', '@prisma', 'engines');
if (fs.existsSync(prismaEnginesSrc)) {
  copyDir(prismaEnginesSrc, prismaEnginesDest);
}

// Копируем .prisma клиент
console.log('Copying .prisma client...');
const prismaClientSrc = path.join(__dirname, '..', 'node_modules', '.prisma');
const prismaClientDest = path.join(buildDir, 'node_modules', '.prisma');
if (fs.existsSync(prismaClientSrc)) {
  copyDir(prismaClientSrc, prismaClientDest);
}

// Копируем @prisma/client
console.log('Copying @prisma/client...');
const prismaClientPkgSrc = path.join(__dirname, '..', 'node_modules', '@prisma', 'client');
const prismaClientPkgDest = path.join(buildDir, 'node_modules', '@prisma', 'client');
if (fs.existsSync(prismaClientPkgSrc)) {
  copyDir(prismaClientPkgSrc, prismaClientPkgDest);
}

console.log('=== Build output ready ===');

// Показываем содержимое
function listFiles(dir, indent = '') {
  const items = fs.readdirSync(dir);
  for (const item of items.slice(0, 30)) {
    const fullPath = path.join(dir, item);
    const isDir = fs.statSync(fullPath).isDirectory();
    console.log(indent + (isDir ? '[DIR] ' : '') + item);
    if (isDir && indent.length < 4) {
      listFiles(fullPath, indent + '  ');
    }
  }
}

console.log('\nBuild output contents:');
listFiles(buildDir);
