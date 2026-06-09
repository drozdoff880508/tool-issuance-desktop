import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { generateQRCode } from '@/lib/auth'

// GET - List all tools
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const status = searchParams.get('status') || ''
    const categoryId = searchParams.get('categoryId') || ''

    const tools = await db.tool.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(categoryId && { categoryId }),
        ...(search && {
          OR: [
            { name: { contains: search } },
            { inventoryNumber: { contains: search } }
          ]
        })
      },
      include: {
        category: true,
        issuances: {
          where: { returnedAt: null },
          include: { employee: true }
        }
      },
      orderBy: { name: 'asc' }
    })

    // Добавляем вычисляемые поля issuedQuantity и availableQuantity
    const toolsWithQuantity = tools.map(tool => {
      const issuedQuantity = tool.issuances?.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0) || 0
      return {
        ...tool,
        issuedQuantity,
        availableQuantity: (tool.quantity || 1) - issuedQuantity
      }
    })

    return NextResponse.json(toolsWithQuantity)
  } catch (error) {
    console.error('Get tools error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

// POST - Create new tool
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const data = await request.json()
    
    // Check if inventory number exists
    const existing = await db.tool.findUnique({
      where: { inventoryNumber: data.inventoryNumber }
    })
    
    if (existing) {
      return NextResponse.json(
        { error: 'Инструмент с таким инвентарным номером уже существует' },
        { status: 400 }
      )
    }

    const tool = await db.tool.create({
      data: {
        name: data.name,
        inventoryNumber: data.inventoryNumber,
        categoryId: data.categoryId,
        qrCode: data.qrCode || generateQRCode(),
        quantity: data.quantity || 1,
        notes: data.notes || null,
        status: 'IN_STOCK'
      },
      include: { category: true }
    })

    return NextResponse.json(tool)
  } catch (error) {
    console.error('Create tool error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
