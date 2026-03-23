const fs = require('fs');
const path = require('path');

console.log('=== Fixing Prisma for standalone build ===');

const rootDir = path.join(__dirname, '..');
const standaloneDir = path.join(rootDir, '.next', 'standalone');
const targetPrismaDir = path.join(standaloneDir, 'node_modules', '.prisma', 'client');
const sourcePrismaDir = path.join(rootDir, 'node_modules', '.prisma', 'client');
const enginesDir = path.join(rootDir, 'node_modules', '@prisma', 'engines');

// Проверяем наличие директорий
if (!fs.existsSync(standaloneDir)) {
  console.log('Standalone directory not found, skipping...');
  process.exit(0);
}

console.log('Source .prisma/client:', sourcePrismaDir);
console.log('Target .prisma/client:', targetPrismaDir);

// Создаём целевую директорию
fs.mkdirSync(targetPrismaDir, { recursive: true });

// Копируем всё из .prisma/client
if (fs.existsSync(sourcePrismaDir)) {
  console.log('\nCopying .prisma/client files...');
  const files = fs.readdirSync(sourcePrismaDir);
  
  for (const file of files) {
    const srcPath = path.join(sourcePrismaDir, file);
    const destPath = path.join(targetPrismaDir, file);
    
    try {
      if (fs.statSync(srcPath).isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
      console.log('  Copied:', file);
    } catch (e) {
      console.log('  Error copying', file, ':', e.message);
    }
  }
}

// Копируем engines в .prisma/client
if (fs.existsSync(enginesDir)) {
  console.log('\nCopying engines to .prisma/client...');
  
  const engineFiles = fs.readdirSync(enginesDir);
  for (const file of engineFiles) {
    const srcPath = path.join(enginesDir, file);
    const destPath = path.join(targetPrismaDir, file);
    
    if (file.endsWith('.node') || file.endsWith('.exe')) {
      try {
        fs.copyFileSync(srcPath, destPath);
        console.log('  Copied engine:', file);
      } catch (e) {
        console.log('  Error copying engine', file, ':', e.message);
      }
    }
  }
  
  // Копируем dist если есть
  const distDir = path.join(enginesDir, 'dist');
  if (fs.existsSync(distDir)) {
    const targetDistDir = path.join(targetPrismaDir, 'dist');
    fs.mkdirSync(targetDistDir, { recursive: true });
    copyDir(distDir, targetDistDir);
    console.log('  Copied dist folder');
  }
}

// Копируем schema.prisma
const schemaSrc = path.join(rootDir, 'prisma', 'schema.prisma');
const schemaDest = path.join(targetPrismaDir, 'schema.prisma');
if (fs.existsSync(schemaSrc)) {
  fs.copyFileSync(schemaSrc, schemaDest);
  console.log('\nCopied schema.prisma');
}

// Копируем prisma CLI в standalone
const prismaCliSrc = path.join(rootDir, 'node_modules', 'prisma');
const prismaCliDest = path.join(standaloneDir, 'node_modules', 'prisma');
if (fs.existsSync(prismaCliSrc) && !fs.existsSync(prismaCliDest)) {
  console.log('\nCopying prisma CLI...');
  fs.mkdirSync(prismaCliDest, { recursive: true });
  copyDir(prismaCliSrc, prismaCliDest);
  console.log('  Copied prisma CLI');
}

// Показываем результат
console.log('\n=== Result ===');
if (fs.existsSync(targetPrismaDir)) {
  console.log('Files in target .prisma/client:');
  const files = fs.readdirSync(targetPrismaDir);
  for (const f of files) {
    const stat = fs.statSync(path.join(targetPrismaDir, f));
    console.log('  ' + (stat.isDirectory() ? '[D] ' : '     ') + f);
  }
}

console.log('\n=== Done ===');

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
