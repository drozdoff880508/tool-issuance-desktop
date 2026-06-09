'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { 
  LogoutButton 
} from '@/components/logout-button'
import { 
  User, 
  Wrench, 
  ArrowRightLeft, 
  Check, 
  AlertTriangle,
  Clock,
  Package,
  Calendar,
  AlertCircle,
  Minus,
  Plus
} from 'lucide-react'

interface Employee {
  id: string
  lastName: string
  firstName: string
  middleName: string | null
  personnelNumber: string
  department: string | null
  qrCode: string
  issuances?: {
    id: string
    quantity: number
    tool: {
      id: string
      name: string
      inventoryNumber: string
      category?: { name: string }
    }
    issuedAt: string
    expectedReturnDate: string | null
  }[]
}

interface Tool {
  id: string
  name: string
  inventoryNumber: string
  qrCode: string
  quantity: number
  category?: { name: string }
  issuances?: {
    id: string
    quantity: number
    employee: {
      id: string
      lastName: string
      firstName: string
      middleName: string | null
    }
  }[]
}

interface HistoryItem {
  type: 'issue' | 'return'
  toolName: string
  employeeName: string
  quantity: number
  time: Date
}

export default function TerminalPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  
  const [mode, setMode] = useState<'employee' | 'tool'>('employee')
  const [scanInput, setScanInput] = useState('')
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [tool, setTool] = useState<Tool | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [processing, setProcessing] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [returnDate, setReturnDate] = useState('')
  const [issueQuantity, setIssueQuantity] = useState(1)
  
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    } else if (user && user.role === 'ADMIN') {
      router.push('/admin')
    }
  }, [user, authLoading, router])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [mode, employee])

  const handleScan = useCallback(async (code: string) => {
    if (!code.trim()) return
    
    setError('')
    setSuccess('')
    
    if (mode === 'employee') {
      try {
        const res = await fetch(`/api/employees/${code}`)
        const data = await res.json()
        
        if (!res.ok) {
          setError(data.error || 'Сотрудник не найден')
          return
        }
        
        setEmployee(data)
        setMode('tool')
      } catch {
        setError('Ошибка соединения')
      }
    } else {
      try {
        const res = await fetch(`/api/tools/${code}`)
        const data = await res.json()
        
        if (!res.ok) {
          setError(data.error || 'Инструмент не найден')
          return
        }
        
        setTool(data)
        setIssueQuantity(1)
      } catch {
        setError('Ошибка соединения')
      }
    }
  }, [mode])

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && scanInput.trim()) {
      handleScan(scanInput.trim())
      setScanInput('')
    }
  }

  const getDefaultReturnDate = () => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  const isOverdue = (dateStr: string | null) => {
    if (!dateStr) return false
    const date = new Date(dateStr)
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    return date < now
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'без срока'
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Calculate available quantity
  const getAvailableQuantity = () => {
    if (!tool) return 0
    const issuedQty = tool.issuances?.reduce((sum, i) => sum + i.quantity, 0) || 0
    return tool.quantity - issuedQty
  }

  const issueTool = async () => {
    if (!tool || !employee) return
    
    setProcessing(true)
    try {
      const res = await fetch('/api/issuances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          toolId: tool.id,
          employeeId: employee.id,
          quantity: issueQuantity,
          expectedReturnDate: returnDate || null
        })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Ошибка выдачи')
        return
      }
      
      setSuccess(`Выдан: ${tool.name} (${issueQuantity} шт.)`)
      setHistory(prev => [{
        type: 'issue',
        toolName: tool.name,
        employeeName: `${employee.lastName} ${employee.firstName}`,
        quantity: issueQuantity,
        time: new Date()
      }, ...prev].slice(0, 20))
      
      setTool(null)
      setReturnDate('')
      setIssueQuantity(1)
      const empRes = await fetch(`/api/employees/${employee.id}`)
      const empData = await empRes.json()
      setEmployee(empData)
    } catch {
      setError('Ошибка соединения')
    } finally {
      setProcessing(false)
    }
  }

  const returnTool = async (issuanceId: string, quantity: number) => {
    setProcessing(true)
    try {
      const res = await fetch(`/api/issuances/${issuanceId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Ошибка возврата')
        return
      }
      
      if (tool) {
        setSuccess(`Принят: ${tool.name} (${quantity} шт.)`)
        setHistory(prev => [{
          type: 'return',
          toolName: tool.name,
          employeeName: `${employee?.lastName || ''} ${employee?.firstName || ''}`,
          quantity: quantity,
          time: new Date()
        }, ...prev].slice(0, 20))
      }
      
      setTool(null)
      if (employee) {
        const empRes = await fetch(`/api/employees/${employee.id}`)
        const empData = await empRes.json()
        setEmployee(empData)
      }
    } catch {
      setError('Ошибка соединения')
    } finally {
      setProcessing(false)
    }
  }

  const resetToEmployee = () => {
    setEmployee(null)
    setTool(null)
    setMode('employee')
    setError('')
    setSuccess('')
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  const availableQty = getAvailableQuantity()

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-6 h-6 text-primary" />
            <div>
              <h1 className="text-lg font-bold">Терминал выдачи</h1>
              <p className="text-xs text-muted-foreground">{user.name}</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 p-3 overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 h-full">
          {/* Left panel - Scan */}
          <div className="space-y-2 flex flex-col">
            {/* Mode indicator */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant={mode === 'employee' ? 'default' : 'secondary'} className="text-sm py-0.5 px-2">
                1. Сотрудник
              </Badge>
              <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
              <Badge variant={mode === 'tool' ? 'default' : 'secondary'} className="text-sm py-0.5 px-2">
                2. Инструмент
              </Badge>
            </div>

            {/* Scan input */}
            <Card className="flex-shrink-0">
              <CardHeader className="pb-1 pt-2 px-3">
                <CardTitle className="text-sm">
                  {mode === 'employee' ? 'Сканирование сотрудника' : 'Сканирование инструмента'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 pb-2 px-3">
                <Input
                  ref={inputRef}
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Наведите сканер на QR-код..."
                  className="text-base h-9"
                  autoComplete="off"
                />
                {employee && mode === 'tool' && (
                  <Button variant="link" onClick={resetToEmployee} className="mt-1 p-0 h-auto text-xs">
                    Сменить сотрудника
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Messages */}
            {error && (
              <Card className="border-red-200 bg-red-50 flex-shrink-0">
                <CardContent className="py-2 px-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-red-700 text-sm font-medium">{error}</span>
                </CardContent>
              </Card>
            )}

            {success && (
              <Card className="border-green-200 bg-green-50 flex-shrink-0">
                <CardContent className="py-2 px-3 flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-green-700 text-sm font-medium">{success}</span>
                </CardContent>
              </Card>
            )}

            {/* Employee info */}
            {employee && (
              <Card className="border-blue-200 bg-blue-50 flex-shrink-0">
                <CardContent className="py-3 px-3">
                  <div className="flex items-start gap-2">
                    <User className="w-8 h-8 text-blue-500 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-blue-900 truncate">
                        {employee.lastName} {employee.firstName} {employee.middleName || ''}
                      </h3>
                      <p className="text-sm text-blue-700">
                        Таб. №: {employee.personnelNumber}
                      </p>
                      {employee.department && (
                        <p className="text-xs text-blue-600">{employee.department}</p>
                      )}
                      
                      {employee.issuances && employee.issuances.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-blue-800 mb-1">
                            На руках ({employee.issuances.reduce((sum, i) => sum + i.quantity, 0)} шт.):
                          </p>
                          <div className="space-y-0.5 max-h-16 overflow-y-auto">
                            {employee.issuances.map(iss => (
                              <div 
                                key={iss.id} 
                                className={`flex items-center gap-1 text-xs p-0.5 rounded ${
                                  isOverdue(iss.expectedReturnDate) ? 'bg-red-100 text-red-800' : ''
                                }`}
                              >
                                <Package className="w-3 h-3" />
                                <span className="truncate">{iss.tool.name}</span>
                                <span className="text-blue-500 text-xs font-medium">×{iss.quantity}</span>
                                <span className="text-blue-400 text-xs">({iss.tool.inventoryNumber})</span>
                                {iss.expectedReturnDate && (
                                  <span className={`flex items-center gap-0.5 ${
                                    isOverdue(iss.expectedReturnDate) ? 'text-red-600 font-medium' : 'text-gray-500'
                                  }`}>
                                    {isOverdue(iss.expectedReturnDate) && <AlertCircle className="w-2 h-2" />}
                                    <Calendar className="w-2 h-2" />
                                    {formatDate(iss.expectedReturnDate)}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Tool info */}
            {tool && (
              <Card className={
                availableQty > 0 ? 'border-green-200 bg-green-50' :
                'border-yellow-200 bg-yellow-50'
              }>
                <CardContent className="py-3 px-3">
                  <div className="flex items-start gap-2">
                    <Wrench className="w-8 h-8 text-green-600 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold truncate">{tool.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Инв. №: {tool.inventoryNumber}
                      </p>
                      {tool.category && (
                        <p className="text-xs">{tool.category.name}</p>
                      )}
                      
                      {/* Количество */}
                      <div className="mt-2 flex items-center gap-2 text-sm">
                        <span className="font-medium">Всего:</span>
                        <span className="text-blue-600 font-bold">{tool.quantity}</span>
                        <span className="text-muted-foreground">|</span>
                        <span className="font-medium">Выдано:</span>
                        <span className="text-orange-600 font-bold">{tool.quantity - availableQty}</span>
                        <span className="text-muted-foreground">|</span>
                        <span className="font-medium">Доступно:</span>
                        <span className={`font-bold ${availableQty > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {availableQty}
                        </span>
                      </div>
                      
                      <div className="mt-2">
                        {availableQty > 0 && (
                          <div className="space-y-2">
                            {/* Выбор количества */}
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium">Кол-во:</span>
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setIssueQuantity(Math.max(1, issueQuantity - 1))}
                                  disabled={issueQuantity <= 1}
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                                <Input
                                  type="number"
                                  value={issueQuantity}
                                  onChange={(e) => {
                                    const val = parseInt(e.target.value) || 1
                                    setIssueQuantity(Math.min(Math.max(1, val), availableQty))
                                  }}
                                  className="w-14 h-7 text-center text-sm px-1"
                                  min={1}
                                  max={availableQty}
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  onClick={() => setIssueQuantity(Math.min(issueQuantity + 1, availableQty))}
                                  disabled={issueQuantity >= availableQty}
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                              </div>
                            </div>
                            
                            {/* Срок возврата */}
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <span className="text-xs font-medium">Срок возврата:</span>
                              <input
                                type="date"
                                value={returnDate || getDefaultReturnDate()}
                                onChange={(e) => setReturnDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="flex-1 px-2 py-1 border rounded text-xs"
                              />
                            </div>
                            
                            <Button 
                              size="sm" 
                              className="w-full h-9 text-sm"
                              onClick={issueTool}
                              disabled={processing}
                            >
                              <Check className="w-4 h-4 mr-1" />
                              Выдать {issueQuantity} шт.
                            </Button>
                          </div>
                        )}
                        
                        {availableQty === 0 && tool.issuances && tool.issuances.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-yellow-800">Весь инструмент выдан:</p>
                            {tool.issuances.map(iss => (
                              <div key={iss.id} className="flex items-center justify-between text-xs">
                                <span>{iss.employee.lastName} {iss.employee.firstName} (×{iss.quantity})</span>
                                {iss.employee.id === employee?.id && (
                                  <Button
                                    size="sm"
                                    variant="secondary"
                                    className="h-7 text-xs"
                                    onClick={() => returnTool(iss.id, iss.quantity)}
                                    disabled={processing}
                                  >
                                    Принять возврат
                                  </Button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right panel - History */}
          <Card className="flex flex-col min-h-0">
            <CardHeader className="pb-1 pt-2 px-3 flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" />
                История за смену
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden pt-0 pb-2 px-3">
              <ScrollArea className="h-full">
                {history.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4 text-sm">
                    Нет записей
                  </p>
                ) : (
                  <div className="space-y-1">
                    {history.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded bg-muted text-sm">
                        {item.type === 'issue' ? (
                          <ArrowRightLeft className="w-4 h-4 text-blue-500" />
                        ) : (
                          <Check className="w-4 h-4 text-green-500" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs truncate">{item.toolName} ×{item.quantity}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.employeeName}</p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(item.time)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
