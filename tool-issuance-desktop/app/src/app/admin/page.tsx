'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Wrench, ClipboardList, AlertTriangle } from 'lucide-react'

interface Stats {
  employees: number
  activeEmployees: number
  tools: number
  availableTools: number
  issuedTools: number
  writtenOffTools: number
  activeIssuances: number
  overdueIssuances: number
}

export default function AdminPage() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [employeesRes, toolsRes, issuancesRes] = await Promise.all([
          fetch('/api/employees'),
          fetch('/api/tools'),
          fetch('/api/issuances?activeOnly=true')
        ])
        
        const employees = await employeesRes.json()
        const tools = await toolsRes.json()
        const issuances = await issuancesRes.json()
        
        setStats({
          employees: employees.length,
          activeEmployees: employees.filter((e: any) => e.isActive).length,
          tools: tools.length,
          availableTools: tools.filter((t: any) => t.status === 'IN_STOCK').length,
          issuedTools: tools.filter((t: any) => t.status === 'ISSUED').length,
          writtenOffTools: tools.filter((t: any) => t.status === 'WRITTEN_OFF').length,
          activeIssuances: issuances.length,
          overdueIssuances: issuances.filter((i: any) => i.isOverdue).length
        })
      } catch (error) {
        console.error('Failed to fetch stats:', error)
      }
    }
    
    fetchStats()
  }, [])

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Обзор</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Сотрудники
            </CardTitle>
            <Users className="w-5 h-5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.activeEmployees}</div>
            <p className="text-sm text-muted-foreground">
              из {stats.employees} зарегистрировано
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Инструмент на складе
            </CardTitle>
            <Wrench className="w-5 h-5 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{stats.availableTools}</div>
            <p className="text-sm text-muted-foreground">
              из {stats.tools} единиц
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Выдано
            </CardTitle>
            <ClipboardList className="w-5 h-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{stats.issuedTools}</div>
            <p className="text-sm text-muted-foreground">
              активных выдач
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Просрочено
            </CardTitle>
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">{stats.overdueIssuances}</div>
            <p className="text-sm text-muted-foreground">
              требуется внимание
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Статус инструмента</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    На складе
                  </Badge>
                </span>
                <span className="font-bold">{stats.availableTools}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                    Выдан
                  </Badge>
                </span>
                <span className="font-bold">{stats.issuedTools}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                    Списан
                  </Badge>
                </span>
                <span className="font-bold">{stats.writtenOffTools}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <a 
              href="/admin/employees" 
              className="block p-4 rounded-lg border hover:bg-muted transition-colors"
            >
              <div className="font-medium">Управление сотрудниками</div>
              <p className="text-sm text-muted-foreground">Добавить, редактировать, печать QR-кодов</p>
            </a>
            <a 
              href="/admin/tools" 
              className="block p-4 rounded-lg border hover:bg-muted transition-colors"
            >
              <div className="font-medium">Управление инструментом</div>
              <p className="text-sm text-muted-foreground">Добавить, редактировать, списание</p>
            </a>
            <a 
              href="/admin/reports" 
              className="block p-4 rounded-lg border hover:bg-muted transition-colors"
            >
              <div className="font-medium">Отчёты</div>
              <p className="text-sm text-muted-foreground">История движений, просроченные выдачи</p>
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
