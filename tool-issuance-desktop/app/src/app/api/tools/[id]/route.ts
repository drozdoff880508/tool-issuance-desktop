import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET - Get tool by ID or QR code
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
    
    // Try to find by ID first, then by QR code
    let tool = await db.tool.findUnique({
      where: { id },
      include: {
        category: true,
        issuances: {
          where: { returnedAt: null },
          include: { employee: true }
        }
      }
    })
    
    if (!tool) {
      tool = await db.tool.findUnique({
        where: { qrCode: id },
        include: {
          category: true,
          issuances: {
            where: { returnedAt: null },
            include: { employee: true }
          }
        }
      })
    }

    if (!tool) {
      return NextResponse.json({ error: 'Инструмент не найден' }, { status: 404 })
    }

    return NextResponse.json(tool)
  } catch (error) {
    console.error('Get tool error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

// PUT - Update tool
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

    // Check if inventory number exists for another tool
    if (data.inventoryNumber) {
      const existing = await db.tool.findFirst({
        where: {
          inventoryNumber: data.inventoryNumber,
          NOT: { id }
        }
      })
      
      if (existing) {
        return NextResponse.json(
          { error: 'Инструмент с таким инвентарным номером уже существует' },
          { status: 400 }
        )
      }
    }

    const tool = await db.tool.update({
      where: { id },
      data: {
        name: data.name,
        inventoryNumber: data.inventoryNumber,
        categoryId: data.categoryId,
        notes: data.notes || null,
        status: data.status
      },
      include: { category: true }
    })

    return NextResponse.json(tool)
  } catch (error) {
    console.error('Update tool error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

// DELETE - Write off tool
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

    // Check if tool is currently issued
    const activeIssuance = await db.issuance.findFirst({
      where: { toolId: id, returnedAt: null }
    })

    if (activeIssuance) {
      return NextResponse.json(
        { error: 'Нельзя списать выданный инструмент' },
        { status: 400 }
      )
    }

    const tool = await db.tool.update({
      where: { id },
      data: { status: 'WRITTEN_OFF' }
    })

    return NextResponse.json(tool)
  } catch (error) {
    console.error('Delete tool error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
