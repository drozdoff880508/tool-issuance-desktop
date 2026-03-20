import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET - Get category by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { id } = await params
    
    const category = await db.toolCategory.findUnique({
      where: { id },
      include: {
        tools: true
      }
    })

    if (!category) {
      return NextResponse.json({ error: 'Категория не найдена' }, { status: 404 })
    }

    return NextResponse.json(category)
  } catch (error) {
    console.error('Get category error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

// PUT - Update category
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { id } = await params
    const data = await request.json()

    if (data.name) {
      const existing = await db.toolCategory.findFirst({
        where: {
          name: data.name,
          NOT: { id }
        }
      })
      
      if (existing) {
        return NextResponse.json(
          { error: 'Категория с таким названием уже существует' },
          { status: 400 }
        )
      }
    }

    const category = await db.toolCategory.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description || null
      }
    })

    return NextResponse.json(category)
  } catch (error) {
    console.error('Update category error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

// DELETE - Delete category
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { id } = await params

    // Check if category has tools
    const toolsCount = await db.tool.count({
      where: { categoryId: id }
    })

    if (toolsCount > 0) {
      return NextResponse.json(
        { error: 'Нельзя удалить категорию с инструментами' },
        { status: 400 }
      )
    }

    await db.toolCategory.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete category error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
