import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { db } from './db'

const SALT_ROUNDS = 10

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createSession(userId: string) {
  const cookieStore = await cookies()
  cookieStore.set('session', userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7 // 1 week
  })
}

export async function getSession() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('session')?.value
  
  if (!userId) return null
  
  const user = await db.user.findUnique({
    where: { id: userId, isActive: true }
  })
  
  if (!user) {
    cookieStore.delete('session')
    return null
  }
  
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    role: user.role
  }
}

export async function clearSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}

export function generateQRCode(): string {
  // Generate a unique QR code using timestamp + random string
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2, 10)
  return `${timestamp}-${random}`.toUpperCase()
}
