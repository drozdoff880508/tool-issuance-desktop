'use server'

import { db } from '@/lib/db'
import { cookies } from 'next/headers'
import { verifyPassword, createSession, clearSession } from '@/lib/auth'

export interface AuthResult {
  success: boolean
  user?: {
    id: string
    username: string
    name: string
    role: 'ADMIN' | 'STOREKEEPER'
  }
  error?: string
}

/**
 * Авторизация пользователя
 * @param username - Имя пользователя
 * @param password - Пароль
 * @returns Результат авторизации
 */
export async function login(username: string, password: string): Promise<AuthResult> {
  try {
    if (!username || !password) {
      return { success: false, error: 'Введите имя пользователя и пароль' }
    }

    const user = await db.user.findUnique({
      where: { username }
    })

    if (!user) {
      return { success: false, error: 'Неверное имя пользователя или пароль' }
    }

    if (!user.isActive) {
      return { success: false, error: 'Пользователь деактивирован' }
    }

    const isValidPassword = await verifyPassword(password, user.password)
    if (!isValidPassword) {
      return { success: false, error: 'Неверное имя пользователя или пароль' }
    }

    // Создаем сессию
    await createSession(user.id)

    return {
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role
      }
    }
  } catch (error) {
    console.error('Login error:', error)
    return { success: false, error: 'Ошибка при входе в систему' }
  }
}

/**
 * Выход из системы
 * @returns Результат выхода
 */
export async function logout(): Promise<{ success: boolean }> {
  try {
    await clearSession()
    return { success: true }
  } catch (error) {
    console.error('Logout error:', error)
    return { success: false }
  }
}

/**
 * Получение текущего пользователя из сессии
 * @returns Данные пользователя или null
 */
export async function getCurrentUser(): Promise<{
  id: string
  username: string
  name: string
  role: 'ADMIN' | 'STOREKEEPER'
} | null> {
  try {
    const cookieStore = await cookies()
    const userId = cookieStore.get('session')?.value

    if (!userId) return null

    const user = await db.user.findUnique({
      where: { id: userId, isActive: true }
    })

    if (!user) {
      // Удаляем невалидную сессию
      cookieStore.delete('session')
      return null
    }

    return {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role
    }
  } catch (error) {
    console.error('Get current user error:', error)
    return null
  }
}
