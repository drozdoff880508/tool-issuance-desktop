'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Wrench, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  
  const { user, login } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') {
        router.push('/admin')
      } else {
        router.push('/terminal')
      }
    }
  }, [user, router])

  useEffect(() => {
    // Check if database is initialized
    fetch('/api/init')
      .then(res => res.json())
      .then(data => {
        if (!data.initialized) {
          // Initialize database
          return fetch('/api/init', { method: 'POST' })
        }
      })
      .then(() => setInitialized(true))
      .catch(() => setInitialized(true))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const result = await login(username, password)
    
    if (!result.success) {
      setError(result.error || 'Ошибка входа')
    }
    
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
            <Wrench className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">Система выдачи инструмента</CardTitle>
          <CardDescription>Инструментальная кладовая</CardDescription>
        </CardHeader>
        <CardContent>
          {!initialized ? (
            <div className="text-center py-4">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
              <p className="mt-2 text-sm text-muted-foreground">Инициализация системы...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="username">Логин</Label>
                <Input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Введите логин"
                  required
                  autoFocus
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Введите пароль"
                  required
                />
              </div>
              
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Войти
              </Button>
              
              <div className="text-sm text-muted-foreground text-center space-y-1">
                <p>Тестовые аккаунты:</p>
                <p>Админ: <code className="bg-muted px-1 rounded">admin</code> / <code className="bg-muted px-1 rounded">admin123</code></p>
                <p>Кладовщик: <code className="bg-muted px-1 rounded">storekeeper</code> / <code className="bg-muted px-1 rounded">store123</code></p>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
