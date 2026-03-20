'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Clock, AlertTriangle, RefreshCw } from 'lucide-react'

interface Issuance {
  id: string
  issuedAt: string
  returnedAt: string | null
  expectedReturnDate: string | null
  isOverdue: boolean
  tool: {
    id: string
    name: string
    inventoryNumber: string
    category: { name: string }
  }
  employee: {
    id: string
    lastName: string
    firstName: string
    middleName: string | null
    personnelNumber: string
    department: string | null
  }
}

export default function IssuancesPage() {
  const [issuances, setIssuances] = useState<Issuance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchIssuances()
  }, [])

  const fetchIssuances = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/issuances?activeOnly=true')
      const data = await res.json()
      setIssuances(data)
    } catch (error) {
      console.error('Failed to fetch issuances:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const handleReturn = async (issuanceId: string) => {
    if (!confirm('Принять инструмент?')) return
    
    try {
      const res = await fetch(`/api/issuances/${issuanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Ошибка возврата')
        return
      }
      
      fetchIssuances()
    } catch (error) {
      console.error('Failed to return tool:', error)
    }
  }

  const getDaysOverdue = (expectedDate: string | null) => {
    if (!expectedDate) return 0
    const expected = new Date(expectedDate)
    const now = new Date()
    const diff = Math.floor((now.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  }

  const overdueCount = issuances.filter(i => i.isOverdue).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Текущие выдачи</h1>
        <Button variant="outline" onClick={fetchIssuances}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Обновить
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Всего активных
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{issuances.length}</div>
          </CardContent>
        </Card>

        <Card className={overdueCount > 0 ? 'border-red-200 bg-red-50' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Просроченных
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${overdueCount > 0 ? 'text-red-600' : ''}`}>
              {overdueCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          <ScrollArea className="h-[calc(100vh-400px)]">
            {loading ? (
              <p className="text-center py-8 text-muted-foreground">Загрузка...</p>
            ) : issuances.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">Нет активных выдач</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Инструмент</TableHead>
                    <TableHead>Сотрудник</TableHead>
                    <TableHead>Цех</TableHead>
                    <TableHead>Выдан</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действие</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issuances.map((issuance) => (
                    <TableRow 
                      key={issuance.id} 
                      className={issuance.isOverdue ? 'bg-red-50' : ''}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{issuance.tool.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {issuance.tool.inventoryNumber}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">
                            {issuance.employee.lastName} {issuance.employee.firstName}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Таб. {issuance.employee.personnelNumber}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>{issuance.employee.department || '-'}</TableCell>
                      <TableCell>{formatDate(issuance.issuedAt)}</TableCell>
                      <TableCell>
                        {issuance.isOverdue ? (
                          <Badge variant="destructive">
                            Просрочен ({getDaysOverdue(issuance.expectedReturnDate)} дн.)
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                            Выдан
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          size="sm" 
                          variant="secondary"
                          onClick={() => handleReturn(issuance.id)}
                        >
                          Принять
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
