import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { generateQRCode } from '@/lib/auth'

// GET - List all employees
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const activeOnly = searchParams.get('activeOnly') === 'true'

    const employees = await db.employee.findMany({
      where: {
        ...(activeOnly && { isActive: true }),
        ...(search && {
          OR: [
            { lastName: { contains: search } },
            { firstName: { contains: search } },
            { middleName: { contains: search } },
            { personnelNumber: { contains: search } }
          ]
        })
      },
      include: {
        issuances: {
          where: { returnedAt: null },
          include: { tool: true }
        }
      },
      orderBy: { lastName: 'asc' }
    })

    return NextResponse.json(employees)
  } catch (error) {
    console.error('Get employees error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}

// POST - Create new employee
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const data = await request.json()
    
    // Check if personnel number exists
    const existing = await db.employee.findUnique({
      where: { personnelNumber: data.personnelNumber }
    })
    
    if (existing) {
      return NextResponse.json(
        { error: 'Сотрудник с таким табельным номером уже существует' },
        { status: 400 }
      )
    }

    const employee = await db.employee.create({
      data: {
        lastName: data.lastName,
        firstName: data.firstName,
        middleName: data.middleName || null,
        personnelNumber: data.personnelNumber,
        department: data.department || null,
        qrCode: data.qrCode || generateQRCode(),
        isActive: true
      }
    })

    return NextResponse.json(employee)
  } catch (error) {
    console.error('Create employee error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
