'use server'

import { db } from '@/lib/db'
import { Issuance, Tool, Employee, ToolStatus, ToolCategory } from '@prisma/client'

export interface IssuanceFilters {
  active?: boolean
  employeeId?: string
  toolId?: string
}

export interface IssuanceData {
  toolId: string
  employeeId: string
  issuedBy: string
  expectedReturnDate?: Date
  notes?: string
}

export interface ReturnData {
  issuanceId: string
  returnedBy: string
  notes?: string
}

export interface IssuanceWithRelations extends Issuance {
  tool: Tool & { category: ToolCategory }
  employee: Employee
}

export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Получить выдачи с фильтрами
 * @param filters - Фильтры (активные, по сотруднику, по инструменту)
 * @returns Список выдач
 */
export async function getIssuances(filters?: IssuanceFilters): Promise<ActionResult<IssuanceWithRelations[]>> {
  try {
    const where: {
      returnedAt?: Date | null
      employeeId?: string
      toolId?: string
    } = {}

    if (filters?.active !== undefined) {
      where.returnedAt = filters.active ? null : { not: null }
    }

    if (filters?.employeeId) {
      where.employeeId = filters.employeeId
    }

    if (filters?.toolId) {
      where.toolId = filters.toolId
    }

    const issuances = await db.issuance.findMany({
      where,
      include: {
        tool: {
          include: {
            category: true
          }
        },
        employee: true
      },
      orderBy: { issuedAt: 'desc' }
    })

    return { success: true, data: issuances as IssuanceWithRelations[] }
  } catch (error) {
    console.error('Get issuances error:', error)
    return { success: false, error: 'Ошибка при получении списка выдач' }
  }
}

/**
 * Выдать инструмент
 * @param data - Данные выдачи
 * @returns Созданная выдача
 */
export async function issueTool(data: IssuanceData): Promise<ActionResult<IssuanceWithRelations>> {
  try {
    // Валидация обязательных полей
    if (!data.toolId || !data.employeeId || !data.issuedBy) {
      return { success: false, error: 'Инструмент, сотрудник и выдающий обязательны' }
    }

    // Проверка существования инструмента
    const tool = await db.tool.findUnique({
      where: { id: data.toolId }
    })

    if (!tool) {
      return { success: false, error: 'Инструмент не найден' }
    }

    // Проверка статуса инструмента
    if (tool.status !== ToolStatus.IN_STOCK) {
      if (tool.status === ToolStatus.ISSUED) {
        return { success: false, error: 'Инструмент уже выдан другому сотруднику' }
      }
      if (tool.status === ToolStatus.WRITTEN_OFF) {
        return { success: false, error: 'Инструмент списан и не может быть выдан' }
      }
    }

    // Проверка существования сотрудника
    const employee = await db.employee.findUnique({
      where: { id: data.employeeId, isActive: true }
    })

    if (!employee) {
      return { success: false, error: 'Сотрудник не найден или неактивен' }
    }

    // Транзакция: создание выдачи и изменение статуса инструмента
    const issuance = await db.$transaction(async (tx) => {
      // Обновляем статус инструмента
      await tx.tool.update({
        where: { id: data.toolId },
        data: { status: ToolStatus.ISSUED }
      })

      // Создаем запись о выдаче
      const newIssuance = await tx.issuance.create({
        data: {
          toolId: data.toolId,
          employeeId: data.employeeId,
          issuedBy: data.issuedBy,
          expectedReturnDate: data.expectedReturnDate || null,
          notes: data.notes || null,
          isOverdue: false
        },
        include: {
          tool: {
            include: {
              category: true
            }
          },
          employee: true
        }
      })

      return newIssuance
    })

    return { success: true, data: issuance as IssuanceWithRelations }
  } catch (error) {
    console.error('Issue tool error:', error)
    return { success: false, error: 'Ошибка при выдаче инструмента' }
  }
}

/**
 * Принять инструмент (возврат)
 * @param data - Данные возврата
 * @returns Обновленная выдача
 */
export async function returnTool(data: ReturnData): Promise<ActionResult<IssuanceWithRelations>> {
  try {
    // Валидация обязательных полей
    if (!data.issuanceId || !data.returnedBy) {
      return { success: false, error: 'ID выдачи и принимающий обязательны' }
    }

    // Проверка существования выдачи
    const issuance = await db.issuance.findUnique({
      where: { id: data.issuanceId },
      include: { tool: true }
    })

    if (!issuance) {
      return { success: false, error: 'Запись о выдаче не найдена' }
    }

    // Проверка: инструмент уже возвращен
    if (issuance.returnedAt) {
      return { success: false, error: 'Инструмент уже возвращен' }
    }

    // Транзакция: обновление выдачи и изменение статуса инструмента
    const updatedIssuance = await db.$transaction(async (tx) => {
      // Обновляем статус инструмента
      await tx.tool.update({
        where: { id: issuance.toolId },
        data: { status: ToolStatus.IN_STOCK }
      })

      // Обновляем запись о выдаче
      const updated = await tx.issuance.update({
        where: { id: data.issuanceId },
        data: {
          returnedAt: new Date(),
          returnedBy: data.returnedBy,
          returnNotes: data.notes || null
        },
        include: {
          tool: {
            include: {
              category: true
            }
          },
          employee: true
        }
      })

      return updated
    })

    return { success: true, data: updatedIssuance as IssuanceWithRelations }
  } catch (error) {
    console.error('Return tool error:', error)
    return { success: false, error: 'Ошибка при возврате инструмента' }
  }
}

/**
 * Получить текущие активные выдачи
 * @returns Список активных выдач
 */
export async function getActiveIssuances(): Promise<ActionResult<IssuanceWithRelations[]>> {
  try {
    const issuances = await db.issuance.findMany({
      where: { returnedAt: null },
      include: {
        tool: {
          include: {
            category: true
          }
        },
        employee: true
      },
      orderBy: { issuedAt: 'desc' }
    })

    return { success: true, data: issuances as IssuanceWithRelations[] }
  } catch (error) {
    console.error('Get active issuances error:', error)
    return { success: false, error: 'Ошибка при получении списка активных выдач' }
  }
}

/**
 * Получить просроченные выдачи
 * @returns Список просроченных выдач
 */
export async function getOverdueIssuances(): Promise<ActionResult<IssuanceWithRelations[]>> {
  try {
    const now = new Date()

    const issuances = await db.issuance.findMany({
      where: {
        returnedAt: null,
        expectedReturnDate: { lt: now }
      },
      include: {
        tool: {
          include: {
            category: true
          }
        },
        employee: true
      },
      orderBy: { expectedReturnDate: 'asc' }
    })

    // Обновляем флаг isOverdue для просроченных
    if (issuances.length > 0) {
      await db.issuance.updateMany({
        where: {
          id: { in: issuances.map(i => i.id) },
          isOverdue: false
        },
        data: { isOverdue: true }
      })
    }

    return { success: true, data: issuances as IssuanceWithRelations[] }
  } catch (error) {
    console.error('Get overdue issuances error:', error)
    return { success: false, error: 'Ошибка при получении списка просроченных выдач' }
  }
}

/**
 * Получить историю выдач
 * @param filters - Фильтры (по сотруднику, по инструменту)
 * @returns История выдач
 */
export async function getIssuanceHistory(filters?: { employeeId?: string; toolId?: string }): Promise<ActionResult<IssuanceWithRelations[]>> {
  try {
    const where: {
      returnedAt: { not: null }
      employeeId?: string
      toolId?: string
    } = {
      returnedAt: { not: null }
    }

    if (filters?.employeeId) {
      where.employeeId = filters.employeeId
    }

    if (filters?.toolId) {
      where.toolId = filters.toolId
    }

    const issuances = await db.issuance.findMany({
      where,
      include: {
        tool: {
          include: {
            category: true
          }
        },
        employee: true
      },
      orderBy: { returnedAt: 'desc' }
    })

    return { success: true, data: issuances as IssuanceWithRelations[] }
  } catch (error) {
    console.error('Get issuance history error:', error)
    return { success: false, error: 'Ошибка при получении истории выдач' }
  }
}

/**
 * Получить выдачу по ID
 * @param id - ID выдачи
 * @returns Данные выдачи
 */
export async function getIssuance(id: string): Promise<ActionResult<IssuanceWithRelations>> {
  try {
    if (!id) {
      return { success: false, error: 'ID выдачи не указан' }
    }

    const issuance = await db.issuance.findUnique({
      where: { id },
      include: {
        tool: {
          include: {
            category: true
          }
        },
        employee: true
      }
    })

    if (!issuance) {
      return { success: false, error: 'Запись о выдаче не найдена' }
    }

    return { success: true, data: issuance as IssuanceWithRelations }
  } catch (error) {
    console.error('Get issuance error:', error)
    return { success: false, error: 'Ошибка при получении данных о выдаче' }
  }
}
