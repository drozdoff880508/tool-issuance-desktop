'use server'

import { db } from '@/lib/db'
import { User, UserRole } from '@prisma/client'
import { hashPassword } from '@/lib/auth'

export interface UserData {
  username: string
  password: string
  name: string
  role: 'ADMIN' | 'STOREKEEPER'
}

export interface UpdateUserData {
  username?: string
  password?: string
  name?: string
  role?: 'ADMIN' | 'STOREKEEPER'
}

export interface SafeUser {
  id: string
  username: string
  name: string
  role: UserRole
  isActive: boolean
  createdAt: Date
}

export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Преобразовать пользователя в безопасный формат (без пароля)
 */
function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt
  }
}

/**
 * Получить всех пользователей
 * @returns Список пользователей (без паролей)
 */
export async function getUsers(): Promise<ActionResult<SafeUser[]>> {
  try {
    const users = await db.user.findMany({
      orderBy: { createdAt: 'desc' }
    })

    return { success: true, data: users.map(toSafeUser) }
  } catch (error) {
    console.error('Get users error:', error)
    return { success: false, error: 'Ошибка при получении списка пользователей' }
  }
}

/**
 * Получить пользователя по ID
 * @param id - ID пользователя
 * @returns Данные пользователя (без пароля)
 */
export async function getUser(id: string): Promise<ActionResult<SafeUser>> {
  try {
    if (!id) {
      return { success: false, error: 'ID пользователя не указан' }
    }

    const user = await db.user.findUnique({
      where: { id }
    })

    if (!user) {
      return { success: false, error: 'Пользователь не найден' }
    }

    return { success: true, data: toSafeUser(user) }
  } catch (error) {
    console.error('Get user error:', error)
    return { success: false, error: 'Ошибка при получении данных пользователя' }
  }
}

/**
 * Создать нового пользователя
 * @param data - Данные пользователя
 * @returns Созданный пользователь (без пароля)
 */
export async function createUser(data: UserData): Promise<ActionResult<SafeUser>> {
  try {
    // Валидация обязательных полей
    if (!data.username || !data.password || !data.name || !data.role) {
      return { success: false, error: 'Все поля обязательны для заполнения' }
    }

    // Валидация длины пароля
    if (data.password.length < 4) {
      return { success: false, error: 'Пароль должен содержать минимум 4 символа' }
    }

    // Валидация роли
    if (!Object.values(UserRole).includes(data.role as UserRole)) {
      return { success: false, error: 'Некорректная роль пользователя' }
    }

    // Проверка уникальности username
    const existingUser = await db.user.findUnique({
      where: { username: data.username.trim() }
    })

    if (existingUser) {
      return { success: false, error: 'Пользователь с таким именем уже существует' }
    }

    // Хеширование пароля
    const hashedPassword = await hashPassword(data.password)

    const user = await db.user.create({
      data: {
        username: data.username.trim(),
        password: hashedPassword,
        name: data.name.trim(),
        role: data.role as UserRole,
        isActive: true
      }
    })

    return { success: true, data: toSafeUser(user) }
  } catch (error) {
    console.error('Create user error:', error)
    return { success: false, error: 'Ошибка при создании пользователя' }
  }
}

/**
 * Обновить данные пользователя
 * @param id - ID пользователя
 * @param data - Новые данные
 * @returns Обновленный пользователь (без пароля)
 */
export async function updateUser(id: string, data: UpdateUserData): Promise<ActionResult<SafeUser>> {
  try {
    if (!id) {
      return { success: false, error: 'ID пользователя не указан' }
    }

    // Проверка существования пользователя
    const existingUser = await db.user.findUnique({
      where: { id }
    })

    if (!existingUser) {
      return { success: false, error: 'Пользователь не найден' }
    }

    // Подготовка данных для обновления
    const updateData: {
      username?: string
      password?: string
      name?: string
      role?: UserRole
    } = {}

    // Проверка уникальности username при изменении
    if (data.username && data.username.trim() !== existingUser.username) {
      const duplicateUsername = await db.user.findUnique({
        where: { username: data.username.trim() }
      })
      if (duplicateUsername) {
        return { success: false, error: 'Пользователь с таким именем уже существует' }
      }
      updateData.username = data.username.trim()
    }

    // Хеширование нового пароля если указан
    if (data.password) {
      if (data.password.length < 4) {
        return { success: false, error: 'Пароль должен содержать минимум 4 символа' }
      }
      updateData.password = await hashPassword(data.password)
    }

    // Обновление имени
    if (data.name) {
      updateData.name = data.name.trim()
    }

    // Валидация и обновление роли
    if (data.role) {
      if (!Object.values(UserRole).includes(data.role as UserRole)) {
        return { success: false, error: 'Некорректная роль пользователя' }
      }
      updateData.role = data.role as UserRole
    }

    // Если нет данных для обновления
    if (Object.keys(updateData).length === 0) {
      return { success: true, data: toSafeUser(existingUser) }
    }

    const user = await db.user.update({
      where: { id },
      data: updateData
    })

    return { success: true, data: toSafeUser(user) }
  } catch (error) {
    console.error('Update user error:', error)
    return { success: false, error: 'Ошибка при обновлении данных пользователя' }
  }
}

/**
 * Деактивировать пользователя (мягкое удаление)
 * @param id - ID пользователя
 * @returns Результат операции
 */
export async function deleteUser(id: string): Promise<ActionResult> {
  try {
    if (!id) {
      return { success: false, error: 'ID пользователя не указан' }
    }

    // Проверка существования пользователя
    const existingUser = await db.user.findUnique({
      where: { id }
    })

    if (!existingUser) {
      return { success: false, error: 'Пользователь не найден' }
    }

    // Нельзя деактивировать самого себя
    // (эта проверка должна выполняться на уровне вызывающего кода с текущей сессией)

    await db.user.update({
      where: { id },
      data: { isActive: false }
    })

    return { success: true }
  } catch (error) {
    console.error('Delete user error:', error)
    return { success: false, error: 'Ошибка при деактивации пользователя' }
  }
}

/**
 * Активировать пользователя (восстановление)
 * @param id - ID пользователя
 * @returns Результат операции
 */
export async function activateUser(id: string): Promise<ActionResult> {
  try {
    if (!id) {
      return { success: false, error: 'ID пользователя не указан' }
    }

    // Проверка существования пользователя
    const existingUser = await db.user.findUnique({
      where: { id }
    })

    if (!existingUser) {
      return { success: false, error: 'Пользователь не найден' }
    }

    await db.user.update({
      where: { id },
      data: { isActive: true }
    })

    return { success: true }
  } catch (error) {
    console.error('Activate user error:', error)
    return { success: false, error: 'Ошибка при активации пользователя' }
  }
}
