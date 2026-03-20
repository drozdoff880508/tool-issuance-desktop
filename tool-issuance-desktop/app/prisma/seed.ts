import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const SALT_ROUNDS = 10

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

async function main() {
  console.log('Начало заполнения базы данных...')

  // Проверяем, есть ли уже данные
  const existingAdmin = await prisma.user.findUnique({
    where: { username: 'admin' }
  })

  if (existingAdmin) {
    console.log('База данных уже содержит данные. Пропускаем seed.')
    return
  }

  // Создаем категории инструмента
  console.log('Создание категорий инструмента...')
  const normalCategory = await prisma.toolCategory.create({
    data: { 
      name: 'Обычный', 
      description: 'Обычный инструмент' 
    }
  })
  
  await prisma.toolCategory.create({
    data: { 
      name: 'Особо ценный', 
      description: 'Особо ценный инструмент, требующий особого учета' 
    }
  })
  
  console.log('Категории созданы: Обычный, Особо ценный')

  // Создаем администратора
  console.log('Создание пользователей...')
  const adminPassword = await hashPassword('admin123')
  await prisma.user.create({
    data: {
      username: 'admin',
      password: adminPassword,
      name: 'Администратор',
      role: 'ADMIN',
      isActive: true
    }
  })
  console.log('Администратор создан: admin / admin123')

  // Создаем кладовщика
  const storekeeperPassword = await hashPassword('store123')
  await prisma.user.create({
    data: {
      username: 'storekeeper',
      password: storekeeperPassword,
      name: 'Кладовщик',
      role: 'STOREKEEPER',
      isActive: true
    }
  })
  console.log('Кладовщик создан: storekeeper / store123')

  // Создаем тестового сотрудника
  console.log('Создание тестового сотрудника...')
  await prisma.employee.create({
    data: {
      lastName: 'Иванов',
      firstName: 'Иван',
      middleName: 'Иванович',
      personnelNumber: '001',
      department: 'Цех №1',
      qrCode: 'EMP001',
      isActive: true
    }
  })
  console.log('Тестовый сотрудник создан: Иванов Иван Иванович (EMP001)')

  // Создаем тестовый инструмент
  console.log('Создание тестового инструмента...')
  await prisma.tool.create({
    data: {
      name: 'Молоток слесарный',
      inventoryNumber: 'INV001',
      categoryId: normalCategory.id,
      qrCode: 'TOOL001',
      status: 'IN_STOCK',
      notes: 'Тестовый инструмент'
    }
  })
  console.log('Тестовый инструмент создан: Молоток слесарный (TOOL001)')

  console.log('Заполнение базы данных завершено!')
}

main()
  .catch((e) => {
    console.error('Ошибка при заполнении базы данных:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
