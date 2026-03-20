import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET - List issuances
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const activeOnly = searchParams.get('activeOnly') === 'true'
    const overdueOnly = searchParams.get('overdueOnly') === 'true'
    const employeeId = searchParams.get('employeeId') || ''
    const toolId = searchParams.get('toolId') || ''

    const issuances = await db.issuance.findMany({
      where: {
        ...(activeOnly && { returnedAt: null }),
        ...(overdueOnly && { returnedAt: null, isOverdue: true }),
        ...(employeeId && { employeeId }),
        ...(toolId && { toolId })
      },
      include: {
        tool: { include: { category: true } },
        employee: true
      },
      orderBy: { issuedAt: 'desc' },
      take: 100
    })

    return NextResponse.json(issuances)
  } catch (error) {
    console.error('Get issuances error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

// POST - Issue tool
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const data = await request.json()
    
    // Check if tool is available
    const tool = await db.tool.findUnique({
      where: { id: data.toolId },
      include: {
        issuances: { where: { returnedAt: null } }
      }
    })
    
    if (!tool) {
      return NextResponse.json({ error: 'Инструмент не найден' }, { status: 404 })
    }
    
    if (tool.status !== 'IN_STOCK') {
      return NextResponse.json(
        { error: 'Инструмент не доступен для выдачи' },
        { status: 400 }
      )
    }

    // Check if employee exists and is active
    const employee = await db.employee.findUnique({
      where: { id: data.employeeId }
    })
    
    if (!employee || !employee.isActive) {
      return NextResponse.json(
        { error: 'Сотрудник не найден или неактивен' },
        { status: 400 }
      )
    }

    // Create issuance and update tool status
    const issuance = await db.$transaction(async (tx) => {
      const newIssuance = await tx.issuance.create({
        data: {
          toolId: data.toolId,
          employeeId: data.employeeId,
          issuedBy: session.id,
          expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
          notes: data.notes || null
        },
        include: {
          tool: { include: { category: true } },
          employee: true
        }
      })
      
      await tx.tool.update({
        where: { id: data.toolId },
        data: { status: 'ISSUED' }
      })
      
      return newIssuance
    })

    return NextResponse.json(issuance)
  } catch (error) {
    console.error('Create issuance error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
