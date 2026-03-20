'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Label } from '@/components/ui/label'
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
  Calendar
} from 'lucide-react'

interface Employee {
  id: string
  lastName: string
  firstName: string
  middleName: string | null
  personnelNumber: string
  department: string | null
  qrCode: string
  issuances: {
    id: string
    tool: {
      id: string
      name: string
      inventoryNumber: string
      category: { name: string }
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
  status: string
  category: { name: string }
  issuances: {
    id: string
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
  
  const inputRef = useRef<HTMLInputElement>(null)

  // Set default return date to tomorrow
  useEffect(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setReturnDate(tomorrow.toISOString().split('T')[0])
  }, [])

  // Redirect if not authenticated or not storekeeper
  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    } else if (user && user.role === 'ADMIN') {
      router.push('/admin')
    }
  }, [user, authLoading, router])

  // Auto-focus input
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [mode, employee])

  // Handle scan
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
      } catch {
        setError('Ошибка соединения')
      }
    }
  }, [mode])

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && scanInput.trim()) {
      handleScan(scanInput.trim())
      setScanInput('')
    }
  }

  // Issue tool
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
          expectedReturnDate: returnDate || null
        })
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Ошибка выдачи')
        return
      }
      
      setSuccess(`Выдан: ${tool.name}`)
      setHistory(prev => [{
        type: 'issue',
        toolName: tool.name,
        employeeName: `${employee.lastName} ${employee.firstName}`,
        time: new Date()
      }, ...prev].slice(0, 20))
      
      setTool(null)
      const empRes = await fetch(`/api/employees/${employee.id}`)
      const empData = await empRes.json()
      setEmployee(empData)
    } catch {
      setError('Ошибка соединения')
    } finally {
      setProcessing(false)
    }
  }

  // Return tool
  const returnTool = async () => {
    if (!tool || !tool.issuances[0]) return
    
    setProcessing(true)
    try {
      const res = await fetch(`/api/issuances/${tool.issuances[0].id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Ошибка возврата')
        return
      }
      
      setSuccess(`Принят: ${tool.name}`)
      setHistory(prev => [{
        type: 'return',
        toolName: tool.name,
        employeeName: `${employee?.lastName || ''} ${employee?.firstName || ''}`,
        time: new Date()
      }, ...prev].slice(0, 20))
      
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

  // Reset to employee scan
  const resetToEmployee = () => {
    setEmployee(null)
    setTool(null)
    setMode('employee')
    setError('')
    setSuccess('')
  }

  // Format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  }

  // Format date for display
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - compact */}
      <header className="bg-white border-b px-4 py-2">
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

      <main className="p-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left panel - Scan */}
          <div className="space-y-3">
            {/* Mode indicator - compact */}
            <div className="flex items-center gap-2">
              <Badge variant={mode === 'employee' ? 'default' : 'secondary'} className="py-0.5 px-2">
                1. Сотрудник
              </Badge>
              <ArrowRightLeft className="w-3 h-3 text-muted-foreground" />
              <Badge variant={mode === 'tool' ? 'default' : 'secondary'} className="py-0.5 px-2">
                2. Инструмент
              </Badge>
            </div>

            {/* Scan input - compact */}
            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base">
                  {mode === 'employee' ? 'Сканирование сотрудника' : 'Сканирование инструмента'}
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <Input
                  ref={inputRef}
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Наведите сканер на QR-код..."
                  className="h-10"
                  autoComplete="off"
                />
                {employee && mode === 'tool' && (
                  <Button variant="link" onClick={resetToEmployee} className="mt-1 p-0 h-auto text-xs">
                    Сменить сотрудника
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Messages - compact */}
            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="py-2 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  <span className="text-red-700 text-sm">{error}</span>
                </CardContent>
              </Card>
            )}

            {success && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="py-2 flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-500" />
                  <span className="text-green-700 text-sm">{success}</span>
                </CardContent>
              </Card>
            )}

            {/* Employee info - compact */}
            {employee && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="py-3">
                  <div className="flex items-start gap-3">
                    <User className="w-8 h-8 text-blue-500 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-blue-900">
                        {employee.lastName} {employee.firstName} {employee.middleName || ''}
                      </h3>
                      <p className="text-sm text-blue-700">
                        Таб. №: {employee.personnelNumber}
                        {employee.department && ` • ${employee.department}`}
                      </p>
                      
                      {employee.issuances.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs font-medium text-blue-800 mb-1">
                            На руках ({employee.issuances.length}):
                          </p>
                          <div className="space-y-0.5">
                            {employee.issuances.map(iss => (
                              <div key={iss.id} className="flex items-center gap-2 text-xs">
                                <Package className="w-3 h-3" />
                                <span>{iss.tool.name}</span>
                                {iss.expectedReturnDate && (
                                  <span className="text-orange-600">
                                    (до {formatDate(iss.expectedReturnDate)})
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

            {/* Tool info - compact */}
            {tool && (
              <Card className={
                tool.status === 'IN_STOCK' ? 'border-green-200 bg-green-50' :
                tool.issuances[0]?.employee.id === employee?.id ? 'border-yellow-200 bg-yellow-50' :
                'border-red-200 bg-red-50'
              }>
                <CardContent className="py-3">
                  <div className="flex items-start gap-3">
                    <Wrench className="w-8 h-8 text-green-600 mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-lg font-bold">{tool.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        Инв. №: {tool.inventoryNumber} • {tool.category.name}
                      </p>
                      
                      <div className="mt-3">
                        {tool.status === 'IN_STOCK' && (
                          <div className="space-y-2">
                            {/* Return date picker */}
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-muted-foreground" />
                              <Label htmlFor="returnDate" className="text-xs">Вернуть до:</Label>
                              <Input
                                id="returnDate"
                                type="date"
                                value={returnDate}
                                onChange={(e) => setReturnDate(e.target.value)}
                                className="h-8 w-auto text-sm"
                              />
                            </div>
                            <Button 
                              size="sm" 
                              className="w-full h-10"
                              onClick={issueTool}
                              disabled={processing}
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Выдать
                            </Button>
                          </div>
                        )}
                        
                        {tool.status === 'ISSUED' && tool.issuances[0]?.employee.id === employee?.id && (
                          <Button 
                            size="sm" 
                            variant="secondary"
                            className="w-full h-10"
                            onClick={returnTool}
                            disabled={processing}
                          >
                            <ArrowRightLeft className="w-4 h-4 mr-2" />
                            Принять возврат
                          </Button>
                        )}
                        
                        {tool.status === 'ISSUED' && tool.issuances[0]?.employee.id !== employee?.id && (
                          <div className="bg-red-100 border border-red-300 rounded p-2">
                            <p className="text-xs font-medium text-red-800">
                              Выдан: {tool.issuances[0].employee.lastName} {tool.issuances[0].employee.firstName}
                            </p>
                          </div>
                        )}
                        
                        {tool.status === 'WRITTEN_OFF' && (
                          <div className="bg-gray-100 border border-gray-300 rounded p-2">
                            <p className="text-xs font-medium text-gray-800">Инструмент списан</p>
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
          <Card className="lg:max-h-[calc(100vh-120px)] flex flex-col">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Clock className="w-4 h-4" />
                История за смену
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden pb-3">
              <ScrollArea className="h-[calc(100vh-220px)]">
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
                          <p className="font-medium truncate">{item.toolName}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.employeeName}</p>
                        </div>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
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
