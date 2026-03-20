'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  LogoutButton 
} from '@/components/logout-button'
import { 
  User, 
  Wrench, 
  ArrowRightLeft, 
  Check, 
  X, 
  AlertTriangle,
  Clock,
  Package
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
  
  const inputRef = useRef<HTMLInputElement>(null)

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
      // Scan employee
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
      // Scan tool
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
          employeeId: employee.id
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
      // Refresh employee data
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
      // Refresh employee data if same employee
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

  if (authLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Wrench className="w-8 h-8 text-primary" />
            <div>
              <h1 className="text-xl font-bold">Терминал выдачи</h1>
              <p className="text-sm text-muted-foreground">{user.name}</p>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left panel - Scan */}
          <div className="space-y-4">
            {/* Mode indicator */}
            <div className="flex items-center gap-2">
              <Badge variant={mode === 'employee' ? 'default' : 'secondary'} className="text-lg py-1 px-3">
                1. Сотрудник
              </Badge>
              <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
              <Badge variant={mode === 'tool' ? 'default' : 'secondary'} className="text-lg py-1 px-3">
                2. Инструмент
              </Badge>
            </div>

            {/* Scan input */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {mode === 'employee' ? 'Сканирование сотрудника' : 'Сканирование инструмента'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Input
                  ref={inputRef}
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  onKeyDown={handleKeyPress}
                  placeholder="Наведите сканер на QR-код..."
                  className="text-lg h-14"
                  autoComplete="off"
                />
                {employee && mode === 'tool' && (
                  <Button variant="link" onClick={resetToEmployee} className="mt-2 p-0 h-auto">
                    Сменить сотрудника
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Messages */}
            {error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="py-4 flex items-center gap-3">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                  <span className="text-red-700 font-medium">{error}</span>
                </CardContent>
              </Card>
            )}

            {success && (
              <Card className="border-green-200 bg-green-50">
                <CardContent className="py-4 flex items-center gap-3">
                  <Check className="w-6 h-6 text-green-500" />
                  <span className="text-green-700 font-medium">{success}</span>
                </CardContent>
              </Card>
            )}

            {/* Employee info */}
            {employee && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="py-6">
                  <div className="flex items-start gap-4">
                    <User className="w-12 h-12 text-blue-500 mt-1" />
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold text-blue-900">
                        {employee.lastName} {employee.firstName} {employee.middleName || ''}
                      </h3>
                      <p className="text-lg text-blue-700">
                        Таб. №: {employee.personnelNumber}
                      </p>
                      {employee.department && (
                        <p className="text-blue-600">{employee.department}</p>
                      )}
                      
                      {employee.issuances.length > 0 && (
                        <div className="mt-4">
                          <p className="text-sm font-medium text-blue-800 mb-2">
                            Инструменты на руках ({employee.issuances.length}):
                          </p>
                          <div className="space-y-1">
                            {employee.issuances.map(iss => (
                              <div key={iss.id} className="flex items-center gap-2 text-sm">
                                <Package className="w-4 h-4" />
                                <span>{iss.tool.name}</span>
                                <span className="text-blue-500">({iss.tool.inventoryNumber})</span>
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
                tool.status === 'IN_STOCK' ? 'border-green-200 bg-green-50' :
                tool.issuances[0]?.employee.id === employee?.id ? 'border-yellow-200 bg-yellow-50' :
                'border-red-200 bg-red-50'
              }>
                <CardContent className="py-6">
                  <div className="flex items-start gap-4">
                    <Wrench className="w-12 h-12 text-green-600 mt-1" />
                    <div className="flex-1">
                      <h3 className="text-2xl font-bold">
                        {tool.name}
                      </h3>
                      <p className="text-lg text-muted-foreground">
                        Инв. №: {tool.inventoryNumber}
                      </p>
                      <p className="text-sm">{tool.category.name}</p>
                      
                      <div className="mt-4">
                        {tool.status === 'IN_STOCK' && (
                          <Button 
                            size="lg" 
                            className="w-full text-lg h-14"
                            onClick={issueTool}
                            disabled={processing}
                          >
                            <Check className="w-5 h-5 mr-2" />
                            Выдать
                          </Button>
                        )}
                        
                        {tool.status === 'ISSUED' && tool.issuances[0]?.employee.id === employee?.id && (
                          <Button 
                            size="lg" 
                            variant="secondary"
                            className="w-full text-lg h-14"
                            onClick={returnTool}
                            disabled={processing}
                          >
                            <ArrowRightLeft className="w-5 h-5 mr-2" />
                            Принять возврат
                          </Button>
                        )}
                        
                        {tool.status === 'ISSUED' && tool.issuances[0]?.employee.id !== employee?.id && (
                          <div className="bg-red-100 border border-red-300 rounded-lg p-4">
                            <p className="font-medium text-red-800">
                              Инструмент выдан другому сотруднику:
                            </p>
                            <p className="text-red-600">
                              {tool.issuances[0].employee.lastName} {tool.issuances[0].employee.firstName}
                            </p>
                          </div>
                        )}
                        
                        {tool.status === 'WRITTEN_OFF' && (
                          <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
                            <p className="font-medium text-gray-800">Инструмент списан</p>
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
          <Card className="lg:max-h-[calc(100vh-200px)] flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                История за смену
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              <ScrollArea className="h-[calc(100vh-350px)]">
                {history.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Нет записей
                  </p>
                ) : (
                  <div className="space-y-2">
                    {history.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-muted">
                        {item.type === 'issue' ? (
                          <ArrowRightLeft className="w-5 h-5 text-blue-500" />
                        ) : (
                          <Check className="w-5 h-5 text-green-500" />
                        )}
                        <div className="flex-1">
                          <p className="font-medium">{item.toolName}</p>
                          <p className="text-sm text-muted-foreground">{item.employeeName}</p>
                        </div>
                        <span className="text-sm text-muted-foreground">
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
