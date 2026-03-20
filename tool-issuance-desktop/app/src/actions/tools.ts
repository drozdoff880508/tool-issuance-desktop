'use server'

import { db } from '@/lib/db'
import { Tool, ToolStatus, ToolCategory } from '@prisma/client'

export interface ToolFilters {
  status?: ToolStatus
  categoryId?: string
  search?: string
}

export interface ToolData {
  name: string
  inventoryNumber: string
  categoryId: string
  notes?: string
}

export interface ToolWithCategory extends Tool {
  category: ToolCategory
}

export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Получить инструменты с фильтрами
 * @param filters - Фильтры (статус, категория, поиск)
 * @returns Список инструментов
 */
export async function getTools(filters?: ToolFilters): Promise<ActionResult<ToolWithCategory[]>> {
  try {
    const where: {
      status?: ToolStatus
      categoryId?: string
      OR?: Array<{ name: { contains: string } } | { inventoryNumber: { contains: string } }>
    } = {}

    if (filters?.status) {
      where.status = filters.status
    }

    if (filters?.categoryId) {
      where.categoryId = filters.categoryId
    }

    if (filters?.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { inventoryNumber: { contains: filters.search } }
      ]
    }

    const tools = await db.tool.findMany({
      where,
      include: {
        category: true
      },
      orderBy: { name: 'asc' }
    })

    return { success: true, data: tools as ToolWithCategory[] }
  } catch (error) {
    console.error('Get tools error:', error)
    return { success: false, error: 'Ошибка при получении списка инструментов' }
  }
}

/**
 * Получить инструмент по ID
 * @param id - ID инструмента
 * @returns Данные инструмента
 */
export async function getTool(id: string): Promise<ActionResult<ToolWithCategory>> {
  try {
    if (!id) {
      return { success: false, error: 'ID инструмента не указан' }
    }

    const tool = await db.tool.findUnique({
      where: { id },
      include: {
        category: true
      }
    })

    if (!tool) {
      return { success: false, error: 'Инструмент не найден' }
    }

    return { success: true, data: tool as ToolWithCategory }
  } catch (error) {
    console.error('Get tool error:', error)
    return { success: false, error: 'Ошибка при получении данных инструмента' }
  }
}

/**
 * Получить инструмент по QR-коду (для сканера)
 * @param qrCode - QR-код инструмента
 * @returns Данные инструмента
 */
export async function getToolByQR(qrCode: string): Promise<ActionResult<ToolWithCategory>> {
  try {
    if (!qrCode) {
      return { success: false, error: 'QR-код не указан' }
    }

    const tool = await db.tool.findUnique({
      where: { qrCode },
      include: {
        category: true
      }
    })

    if (!tool) {
      return { success: false, error: 'Инструмент с таким QR-кодом не найден' }
    }

    if (tool.status === ToolStatus.WRITTEN_OFF) {
      return { success: false, error: 'Инструмент списан' }
    }

    return { success: true, data: tool as ToolWithCategory }
  } catch (error) {
    console.error('Get tool by QR error:', error)
    return { success: false, error: 'Ошибка при поиске инструмента по QR-коду' }
  }
}

/**
 * Создать новый инструмент
 * @param data - Данные инструмента
 * @returns Созданный инструмент
 */
export async function createTool(data: ToolData): Promise<ActionResult<ToolWithCategory>> {
  try {
    // Валидация обязательных полей
    if (!data.name || !data.inventoryNumber || !data.categoryId) {
      return { success: false, error: 'Название, инвентарный номер и категория обязательны' }
    }

    // Проверка существования категории
    const category = await db.toolCategory.findUnique({
      where: { id: data.categoryId }
    })

    if (!category) {
      return { success: false, error: 'Категория не найдена' }
    }

    // Проверка уникальности инвентарного номера
    const existingTool = await db.tool.findUnique({
      where: { inventoryNumber: data.inventoryNumber }
    })

    if (existingTool) {
      return { success: false, error: 'Инструмент с таким инвентарным номером уже существует' }
    }

    // Генерация уникального QR-кода
    let qrCode = crypto.randomUUID()
    let attempts = 0
    while (await db.tool.findUnique({ where: { qrCode } })) {
      qrCode = crypto.randomUUID()
      attempts++
      if (attempts > 10) {
        return { success: false, error: 'Не удалось сгенерировать уникальный QR-код' }
      }
    }

    const tool = await db.tool.create({
      data: {
        name: data.name,
        inventoryNumber: data.inventoryNumber,
        categoryId: data.categoryId,
        notes: data.notes || null,
        qrCode,
        status: ToolStatus.IN_STOCK
      },
      include: {
        category: true
      }
    })

    return { success: true, data: tool as ToolWithCategory }
  } catch (error) {
    console.error('Create tool error:', error)
    return { success: false, error: 'Ошибка при создании инструмента' }
  }
}

/**
 * Обновить данные инструмента
 * @param id - ID инструмента
 * @param data - Новые данные
 * @returns Обновленный инструмент
 */
export async function updateTool(id: string, data: Partial<ToolData>): Promise<ActionResult<ToolWithCategory>> {
  try {
    if (!id) {
      return { success: false, error: 'ID инструмента не указан' }
    }

    // Проверка существования инструмента
    const existingTool = await db.tool.findUnique({
      where: { id }
    })

    if (!existingTool) {
      return { success: false, error: 'Инструмент не найден' }
    }

    // Проверка уникальности инвентарного номера при изменении
    if (data.inventoryNumber && data.inventoryNumber !== existingTool.inventoryNumber) {
      const duplicateInventory = await db.tool.findUnique({
        where: { inventoryNumber: data.inventoryNumber }
      })
      if (duplicateInventory) {
        return { success: false, error: 'Инструмент с таким инвентарным номером уже существует' }
      }
    }

    // Проверка существования категории при изменении
    if (data.categoryId && data.categoryId !== existingTool.categoryId) {
      const category = await db.toolCategory.findUnique({
        where: { id: data.categoryId }
      })
      if (!category) {
        return { success: false, error: 'Категория не найдена' }
      }
    }

    const tool = await db.tool.update({
      where: { id },
      data: {
        name: data.name,
        inventoryNumber: data.inventoryNumber,
        categoryId: data.categoryId,
        notes: data.notes || null
      },
      include: {
        category: true
      }
    })

    return { success: true, data: tool as ToolWithCategory }
  } catch (error) {
    console.error('Update tool error:', error)
    return { success: false, error: 'Ошибка при обновлении данных инструмента' }
  }
}

/**
 * Списать инструмент (status = WRITTEN_OFF)
 * @param id - ID инструмента
 * @returns Результат операции
 */
export async function deleteTool(id: string): Promise<ActionResult> {
  try {
    if (!id) {
      return { success: false, error: 'ID инструмента не указан' }
    }

    // Проверка существования инструмента
    const existingTool = await db.tool.findUnique({
      where: { id }
    })

    if (!existingTool) {
      return { success: false, error: 'Инструмент не найден' }
    }

    // Проверка: инструмент уже списан
    if (existingTool.status === ToolStatus.WRITTEN_OFF) {
      return { success: false, error: 'Инструмент уже списан' }
    }

    // Проверка: инструмент выдан
    if (existingTool.status === ToolStatus.ISSUED) {
      return { success: false, error: 'Невозможно списать выданный инструмент. Сначала примите его обратно.' }
    }

    await db.tool.update({
      where: { id },
      data: { status: ToolStatus.WRITTEN_OFF }
    })

    return { success: true }
  } catch (error) {
    console.error('Delete tool error:', error)
    return { success: false, error: 'Ошибка при списании инструмента' }
  }
}
