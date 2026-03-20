import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET - Get employee by ID or QR code
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
    let employee = await db.employee.findUnique({
      where: { id },
      include: {
        issuances: {
          where: { returnedAt: null },
          include: { tool: { include: { category: true } } }
        }
      }
    })
    
    if (!employee) {
      employee = await db.employee.findUnique({
        where: { qrCode: id },
        include: {
          issuances: {
            where: { returnedAt: null },
            include: { tool: { include: { category: true } } }
          }
        }
      })
    }

    if (!employee) {
      return NextResponse.json({ error: 'Сотрудник не найден' }, { status: 404 })
    }

    return NextResponse.json(employee)
  } catch (error) {
    console.error('Get employee error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

// PUT - Update employee
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

    // Check if personnel number exists for another employee
    if (data.personnelNumber) {
      const existing = await db.employee.findFirst({
        where: {
          personnelNumber: data.personnelNumber,
          NOT: { id }
        }
      })
      
      if (existing) {
        return NextResponse.json(
          { error: 'Сотрудник с таким табельным номером уже существует' },
          { status: 400 }
        )
      }
    }

    const employee = await db.employee.update({
      where: { id },
      data: {
        lastName: data.lastName,
        firstName: data.firstName,
        middleName: data.middleName || null,
        personnelNumber: data.personnelNumber,
        department: data.department || null,
        isActive: data.isActive ?? true
      }
    })

    return NextResponse.json(employee)
  } catch (error) {
    console.error('Update employee error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

// DELETE - Deactivate employee
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

    // Check if employee has active issuances
    const activeIssuances = await db.issuance.count({
      where: { employeeId: id, returnedAt: null }
    })

    if (activeIssuances > 0) {
      return NextResponse.json(
        { error: 'Нельзя деактивировать сотрудника с активными выдачами' },
        { status: 400 }
      )
    }

    const employee = await db.employee.update({
      where: { id },
      data: { isActive: false }
    })

    return NextResponse.json(employee)
  } catch (error) {
    console.error('Delete employee error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
