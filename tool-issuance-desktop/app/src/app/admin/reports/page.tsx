'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AlertTriangle, Clock, History, FileText, Download } from 'lucide-react'

interface Issuance {
  id: string
  issuedAt: string
  returnedAt: string | null
  expectedReturnDate: string | null
  isOverdue: boolean
  notes: string | null
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

export default function ReportsPage() {
  const [activeIssuances, setActiveIssuances] = useState<Issuance[]>([])
  const [overdueIssuances, setOverdueIssuances] = useState<Issuance[]>([])
  const [history, setHistory] = useState<Issuance[]>([])
  const [loading, setLoading] = useState(true)
  const [historyFilter, setHistoryFilter] = useState('all')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [activeRes, historyRes] = await Promise.all([
        fetch('/api/issuances?activeOnly=true'),
        fetch('/api/issuances/history')
      ])

      const active = await activeRes.json()
      const hist = await historyRes.json()

      setActiveIssuances(active)
      setOverdueIssuances(active.filter((i: Issuance) => i.isOverdue))
      setHistory(hist)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDaysOverdue = (expectedDate: string | null) => {
    if (!expectedDate) return 0
    const expected = new Date(expectedDate)
    const now = new Date()
    const diff = Math.floor((now.getTime() - expected.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, diff)
  }

  const exportToCSV = (data: Issuance[], filename: string) => {
    const headers = ['Инструмент', 'Инв. номер', 'Категория', 'Сотрудник', 'Таб. номер', 'Цех', 'Выдан', 'Ожидаемый возврат', 'Статус']
    const rows = data.map(i => [
      i.tool.name,
      i.tool.inventoryNumber,
      i.tool.category.name,
      `${i.employee.lastName} ${i.employee.firstName} ${i.employee.middleName || ''}`,
      i.employee.personnelNumber,
      i.employee.department || '-',
      formatDate(i.issuedAt),
      formatDate(i.expectedReturnDate),
      i.returnedAt ? 'Возвращён' : (i.isOverdue ? 'Просрочен' : 'Выдан')
    ])

    const csv = [headers, ...rows].map(row => row.join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${filename}.csv`
    link.click()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Отчёты</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-yellow-200 bg-yellow-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-yellow-800 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Активные выдачи
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-700">{activeIssuances.length}</div>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Просроченные
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-700">{overdueIssuances.length}</div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-blue-800 flex items-center gap-2">
              <History className="w-4 h-4" />
              Всего записей
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-blue-700">{history.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active" className="gap-2">
            <Clock className="w-4 h-4" />
            Активные ({activeIssuances.length})
          </TabsTrigger>
          <TabsTrigger value="overdue" className="gap-2">
            <AlertTriangle className="w-4 h-4" />
            Просроченные ({overdueIssuances.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <History className="w-4 h-4" />
            История
          </TabsTrigger>
        </TabsList>

        {/* Active Issuances */}
        <TabsContent value="active">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Текущие выдачи</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportToCSV(activeIssuances, 'active_issuances')}>
                <Download className="w-4 h-4 mr-2" />
                Экспорт CSV
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-450px)]">
                {activeIssuances.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Нет активных выдач</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Инструмент</TableHead>
                        <TableHead>Сотрудник</TableHead>
                        <TableHead>Цех</TableHead>
                        <TableHead>Выдан</TableHead>
                        <TableHead>Срок возврата</TableHead>
                        <TableHead>Статус</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeIssuances.map((issuance) => (
                        <TableRow key={issuance.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{issuance.tool.name}</p>
                              <p className="text-sm text-muted-foreground">{issuance.tool.inventoryNumber}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {issuance.employee.lastName} {issuance.employee.firstName} {issuance.employee.middleName || ''}
                              </p>
                              <p className="text-sm text-muted-foreground">Таб. {issuance.employee.personnelNumber}</p>
                            </div>
                          </TableCell>
                          <TableCell>{issuance.employee.department || '-'}</TableCell>
                          <TableCell>{formatDate(issuance.issuedAt)}</TableCell>
                          <TableCell>{formatDate(issuance.expectedReturnDate)}</TableCell>
                          <TableCell>
                            {issuance.isOverdue ? (
                              <Badge variant="destructive">
                                Просрочен ({getDaysOverdue(issuance.expectedReturnDate)} дн.)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                Выдан
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Overdue Issuances */}
        <TabsContent value="overdue">
          <Card className="border-red-200">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Просроченные выдачи
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportToCSV(overdueIssuances, 'overdue_issuances')}>
                <Download className="w-4 h-4 mr-2" />
                Экспорт CSV
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-450px)]">
                {overdueIssuances.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Нет просроченных выдач</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Инструмент</TableHead>
                        <TableHead>Сотрудник</TableHead>
                        <TableHead>Цех</TableHead>
                        <TableHead>Выдан</TableHead>
                        <TableHead>Срок возврата</TableHead>
                        <TableHead>Просрочено</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {overdueIssuances.map((issuance) => (
                        <TableRow key={issuance.id} className="bg-red-50">
                          <TableCell>
                            <div>
                              <p className="font-medium">{issuance.tool.name}</p>
                              <p className="text-sm text-muted-foreground">{issuance.tool.inventoryNumber}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {issuance.employee.lastName} {issuance.employee.firstName} {issuance.employee.middleName || ''}
                              </p>
                              <p className="text-sm text-muted-foreground">Таб. {issuance.employee.personnelNumber}</p>
                            </div>
                          </TableCell>
                          <TableCell>{issuance.employee.department || '-'}</TableCell>
                          <TableCell>{formatDate(issuance.issuedAt)}</TableCell>
                          <TableCell>{formatDate(issuance.expectedReturnDate)}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">
                              {getDaysOverdue(issuance.expectedReturnDate)} дней
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History */}
        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>История всех операций</CardTitle>
              <Button variant="outline" size="sm" onClick={() => exportToCSV(history, 'issuance_history')}>
                <Download className="w-4 h-4 mr-2" />
                Экспорт CSV
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[calc(100vh-450px)]">
                {history.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Нет записей</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Инструмент</TableHead>
                        <TableHead>Сотрудник</TableHead>
                        <TableHead>Выдан</TableHead>
                        <TableHead>Возвращён</TableHead>
                        <TableHead>Статус</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {history.map((issuance) => (
                        <TableRow key={issuance.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{issuance.tool.name}</p>
                              <p className="text-sm text-muted-foreground">{issuance.tool.inventoryNumber}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {issuance.employee.lastName} {issuance.employee.firstName} {issuance.employee.middleName || ''}
                              </p>
                              <p className="text-sm text-muted-foreground">Таб. {issuance.employee.personnelNumber}</p>
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(issuance.issuedAt)}</TableCell>
                          <TableCell>{formatDate(issuance.returnedAt)}</TableCell>
                          <TableCell>
                            {issuance.returnedAt ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                Возвращён
                              </Badge>
                            ) : issuance.isOverdue ? (
                              <Badge variant="destructive">Просрочен</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                                Выдан
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
