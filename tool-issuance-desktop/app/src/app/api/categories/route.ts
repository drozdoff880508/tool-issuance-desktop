import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET - List all categories
export async function GET() {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const categories = await db.toolCategory.findMany({
      include: {
        _count: { select: { tools: true } }
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(categories)
  } catch (error) {
    console.error('Get categories error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

// POST - Create new category
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const data = await request.json()
    
    const existing = await db.toolCategory.findUnique({
      where: { name: data.name }
    })
    
    if (existing) {
      return NextResponse.json(
        { error: 'Категория с таким названием уже существует' },
        { status: 400 }
      )
    }

    const category = await db.toolCategory.create({
      data: {
        name: data.name,
        description: data.description || null
      }
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error('Create category error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
