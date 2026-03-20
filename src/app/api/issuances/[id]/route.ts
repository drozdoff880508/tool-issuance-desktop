import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// PUT - Return tool
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

    // Check if issuance exists
    const issuance = await db.issuance.findUnique({
      where: { id },
      include: { tool: true }
    })

    if (!issuance) {
      return NextResponse.json({ error: 'Выдача не найдена' }, { status: 404 })
    }

    if (issuance.returnedAt) {
      return NextResponse.json(
        { error: 'Инструмент уже возвращён' },
        { status: 400 }
      )
    }

    // Return tool
    const updatedIssuance = await db.$transaction(async (tx) => {
      const updated = await tx.issuance.update({
        where: { id },
        data: {
          returnedAt: new Date(),
          returnedBy: session.id,
          returnNotes: data.returnNotes || null
        },
        include: {
          tool: { include: { category: true } },
          employee: true
        }
      })
      
      await tx.tool.update({
        where: { id: issuance.toolId },
        data: { status: 'IN_STOCK' }
      })
      
      return updated
    })

    return NextResponse.json(updatedIssuance)
  } catch (error) {
    console.error('Return tool error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
