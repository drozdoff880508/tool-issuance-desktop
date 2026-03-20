'use server'

import { db } from '@/lib/db'
import { ToolCategory } from '@prisma/client'

export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Получить все категории
 * @returns Список категорий
 */
export async function getCategories(): Promise<ActionResult<ToolCategory[]>> {
  try {
    const categories = await db.toolCategory.findMany({
      orderBy: { name: 'asc' }
    })
    return { success: true, data: categories }
  } catch (error) {
    console.error('Get categories error:', error)
    return { success: false, error: 'Ошибка при получении списка категорий' }
  }
}

/**
 * Получить категорию по ID
 * @param id - ID категории
 * @returns Данные категории
 */
export async function getCategory(id: string): Promise<ActionResult<ToolCategory>> {
  try {
    if (!id) {
      return { success: false, error: 'ID категории не указан' }
    }

    const category = await db.toolCategory.findUnique({
      where: { id }
    })

    if (!category) {
      return { success: false, error: 'Категория не найдена' }
    }

    return { success: true, data: category }
  } catch (error) {
    console.error('Get category error:', error)
    return { success: false, error: 'Ошибка при получении данных категории' }
  }
}

/**
 * Создать новую категорию
 * @param name - Название категории
 * @param description - Описание (опционально)
 * @returns Созданная категория
 */
export async function createCategory(name: string, description?: string): Promise<ActionResult<ToolCategory>> {
  try {
    if (!name || name.trim() === '') {
      return { success: false, error: 'Название категории обязательно' }
    }

    // Проверка уникальности названия
    const existingCategory = await db.toolCategory.findUnique({
      where: { name: name.trim() }
    })

    if (existingCategory) {
      return { success: false, error: 'Категория с таким названием уже существует' }
    }

    const category = await db.toolCategory.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null
      }
    })

    return { success: true, data: category }
  } catch (error) {
    console.error('Create category error:', error)
    return { success: false, error: 'Ошибка при создании категории' }
  }
}

/**
 * Обновить категорию
 * @param id - ID категории
 * @param name - Новое название
 * @param description - Новое описание (опционально)
 * @returns Обновленная категория
 */
export async function updateCategory(id: string, name: string, description?: string): Promise<ActionResult<ToolCategory>> {
  try {
    if (!id) {
      return { success: false, error: 'ID категории не указан' }
    }

    if (!name || name.trim() === '') {
      return { success: false, error: 'Название категории обязательно' }
    }

    // Проверка существования категории
    const existingCategory = await db.toolCategory.findUnique({
      where: { id }
    })

    if (!existingCategory) {
      return { success: false, error: 'Категория не найдена' }
    }

    // Проверка уникальности названия при изменении
    if (name.trim() !== existingCategory.name) {
      const duplicateCategory = await db.toolCategory.findUnique({
        where: { name: name.trim() }
      })
      if (duplicateCategory) {
        return { success: false, error: 'Категория с таким названием уже существует' }
      }
    }

    const category = await db.toolCategory.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description?.trim() || null
      }
    })

    return { success: true, data: category }
  } catch (error) {
    console.error('Update category error:', error)
    return { success: false, error: 'Ошибка при обновлении категории' }
  }
}

/**
 * Удалить категорию
 * @param id - ID категории
 * @returns Результат операции
 */
export async function deleteCategory(id: string): Promise<ActionResult> {
  try {
    if (!id) {
      return { success: false, error: 'ID категории не указан' }
    }

    // Проверка существования категории
    const existingCategory = await db.toolCategory.findUnique({
      where: { id }
    })

    if (!existingCategory) {
      return { success: false, error: 'Категория не найдена' }
    }

    // Проверка наличия инструментов в категории
    const toolsInCategory = await db.tool.findFirst({
      where: { categoryId: id }
    })

    if (toolsInCategory) {
      return { success: false, error: 'Невозможно удалить категорию, содержащую инструменты' }
    }

    await db.toolCategory.delete({
      where: { id }
    })

    return { success: true }
  } catch (error) {
    console.error('Delete category error:', error)
    return { success: false, error: 'Ошибка при удалении категории' }
  }
}
