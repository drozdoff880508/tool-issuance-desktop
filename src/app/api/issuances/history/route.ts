import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getSession } from '@/lib/auth'

// GET - History by employee or tool
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session) {
      return NextResponse.json({ error: 'Не авторизован' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const employeeId = searchParams.get('employeeId')
    const toolId = searchParams.get('toolId')

    const history = await db.issuance.findMany({
      where: {
        ...(employeeId && { employeeId }),
        ...(toolId && { toolId })
      },
      include: {
        tool: { include: { category: true } },
        employee: true
      },
      orderBy: { issuedAt: 'desc' },
      take: 200
    })

    return NextResponse.json(history)
  } catch (error) {
    console.error('Get history error:', error)
    return NextResponse.json({ error: 'Ошибка сервера' }, { status: 500 })
  }
}
