import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { hashPassword } from '@/lib/auth'

export async function POST() {
  try {
    // Check if already initialized
    const existingAdmin = await db.user.findUnique({
      where: { username: 'admin' }
    })
    
    if (existingAdmin) {
      return NextResponse.json({ message: 'База данных уже инициализирована' })
    }

    // Create default categories
    const normalCategory = await db.toolCategory.create({
      data: { name: 'Обычный', description: 'Обычный инструмент' }
    })
    
    await db.toolCategory.create({
      data: { name: 'Особо ценный', description: 'Особо ценный инструмент' }
    })

    // Create default admin user
    const hashedPassword = await hashPassword('admin123')
    await db.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        name: 'Администратор',
        role: 'ADMIN',
        isActive: true
      }
    })

    // Create default storekeeper user
    const storekeeperPassword = await hashPassword('store123')
    await db.user.create({
      data: {
        username: 'storekeeper',
        password: storekeeperPassword,
        name: 'Кладовщик',
        role: 'STOREKEEPER',
        isActive: true
      }
    })

    // Create sample employee
    await db.employee.create({
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

    // Create sample tool
    await db.tool.create({
      data: {
        name: 'Молоток слесарный',
        inventoryNumber: 'INV001',
        categoryId: normalCategory.id,
        qrCode: 'TOOL001',
        status: 'IN_STOCK'
      }
    })

    return NextResponse.json({ 
      message: 'База данных инициализирована',
      users: [
        { username: 'admin', password: 'admin123', role: 'ADMIN' },
        { username: 'storekeeper', password: 'store123', role: 'STOREKEEPER' }
      ]
    })
  } catch (error) {
    console.error('Init error:', error)
    return NextResponse.json({ error: 'Ошибка инициализации' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const admin = await db.user.findUnique({
      where: { username: 'admin' }
    })
    
    return NextResponse.json({ initialized: !!admin })
  } catch (error) {
    console.error('Check init error:', error)
    return NextResponse.json({ error: 'Ошибка проверки' }, { status: 500 })
  }
}
