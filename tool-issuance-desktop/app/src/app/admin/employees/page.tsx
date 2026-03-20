'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, Plus, Edit, QrCode, UserX, Printer, Download } from 'lucide-react'
import { QRCode } from '@/components/ui/qrcode'

interface Employee {
  id: string
  lastName: string
  firstName: string
  middleName: string | null
  personnelNumber: string
  department: string | null
  qrCode: string
  isActive: boolean
  issuances: { id: string }[]
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrEmployee, setQrEmployee] = useState<Employee | null>(null)
  const printRef = useRef<HTMLDivElement>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    lastName: '',
    firstName: '',
    middleName: '',
    personnelNumber: '',
    department: ''
  })

  useEffect(() => {
    fetchEmployees()
  }, [search])

  const fetchEmployees = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/employees?search=${encodeURIComponent(search)}`)
      const data = await res.json()
      setEmployees(data)
    } catch (error) {
      console.error('Failed to fetch employees:', error)
    } finally {
      setLoading(false)
    }
  }

  const openCreateDialog = () => {
    setEditEmployee(null)
    setFormData({
      lastName: '',
      firstName: '',
      middleName: '',
      personnelNumber: '',
      department: ''
    })
    setDialogOpen(true)
  }

  const openEditDialog = (employee: Employee) => {
    setEditEmployee(employee)
    setFormData({
      lastName: employee.lastName,
      firstName: employee.firstName,
      middleName: employee.middleName || '',
      personnelNumber: employee.personnelNumber,
      department: employee.department || ''
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editEmployee) {
        const res = await fetch(`/api/employees/${editEmployee.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
        
        if (!res.ok) {
          const data = await res.json()
          alert(data.error || 'Ошибка сохранения')
          return
        }
      } else {
        const res = await fetch('/api/employees', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        })
        
        if (!res.ok) {
          const data = await res.json()
          alert(data.error || 'Ошибка создания')
          return
        }
      }
      
      setDialogOpen(false)
      fetchEmployees()
    } catch (error) {
      console.error('Failed to save employee:', error)
    }
  }

  const handleDeactivate = async (employee: Employee) => {
    if (!confirm(`Деактивировать сотрудника ${employee.lastName} ${employee.firstName}?`)) {
      return
    }
    
    try {
      const res = await fetch(`/api/employees/${employee.id}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Ошибка деактивации')
        return
      }
      
      fetchEmployees()
    } catch (error) {
      console.error('Failed to deactivate employee:', error)
    }
  }

  const openQrDialog = (employee: Employee) => {
    setQrEmployee(employee)
    setQrDialogOpen(true)
  }

  const handlePrint = () => {
    const printContent = printRef.current
    if (!printContent) return
    
    const printWindow = window.open('', '_blank')
    if (!printWindow) return
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR-код сотрудника</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .qr-container { text-align: center; }
            .qr-code { margin: 20px 0; }
            .info { font-size: 14px; margin-top: 10px; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.print()
  }

  const exportToCSV = () => {
    const headers = ['Фамилия', 'Имя', 'Отчество', 'Табельный номер', 'Цех/отдел', 'Статус', 'QR-код']
    const rows = employees.map(emp => [
      emp.lastName,
      emp.firstName,
      emp.middleName || '',
      emp.personnelNumber,
      emp.department || '',
      emp.isActive ? 'Активен' : 'Неактивен',
      emp.qrCode
    ])
    
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n')
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `employees_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const exportToJSON = () => {
    const data = employees.map(emp => ({
      lastName: emp.lastName,
      firstName: emp.firstName,
      middleName: emp.middleName,
      personnelNumber: emp.personnelNumber,
      department: emp.department,
      isActive: emp.isActive,
      qrCode: emp.qrCode,
      toolsOnHand: emp.issuances?.length || 0
    }))
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `employees_${new Date().toISOString().split('T')[0]}.json`
    link.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Сотрудники</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV} disabled={employees.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={exportToJSON} disabled={employees.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            JSON
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Добавить
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по ФИО или табельному номеру..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-350px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ФИО</TableHead>
                  <TableHead>Таб. номер</TableHead>
                  <TableHead>Цех/отдел</TableHead>
                  <TableHead>Инструмент</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="text-right">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      Загрузка...
                    </TableCell>
                  </TableRow>
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Сотрудники не найдены
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((employee) => (
                    <TableRow key={employee.id} className={!employee.isActive ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">
                        {employee.lastName} {employee.firstName} {employee.middleName || ''}
                      </TableCell>
                      <TableCell>{employee.personnelNumber}</TableCell>
                      <TableCell>{employee.department || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{employee.issuances?.length || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        {employee.isActive ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            Активен
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
                            Неактивен
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openQrDialog(employee)}
                            title="QR-код"
                          >
                            <QrCode className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(employee)}
                            title="Редактировать"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {employee.isActive && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeactivate(employee)}
                              title="Деактивировать"
                            >
                              <UserX className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editEmployee ? 'Редактировать сотрудника' : 'Добавить сотрудника'}
            </DialogTitle>
            <DialogDescription>
              Заполните данные сотрудника
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="lastName">Фамилия *</Label>
                  <Input
                    id="lastName"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="firstName">Имя *</Label>
                  <Input
                    id="firstName"
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="middleName">Отчество</Label>
                <Input
                  id="middleName"
                  value={formData.middleName}
                  onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="personnelNumber">Табельный номер *</Label>
                <Input
                  id="personnelNumber"
                  value={formData.personnelNumber}
                  onChange={(e) => setFormData({ ...formData, personnelNumber: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="department">Цех/отдел</Label>
                <Input
                  id="department"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit">
                {editEmployee ? 'Сохранить' : 'Добавить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR-код сотрудника</DialogTitle>
          </DialogHeader>
          <div ref={printRef} className="qr-container text-center">
            {qrEmployee && (
              <>
                <div className="qr-code flex justify-center">
                  <div className="p-4 bg-white border rounded-lg inline-block">
                    <QRCode value={qrEmployee.qrCode} size={192} />
                  </div>
                </div>
                <div className="info space-y-1">
                  <p className="font-bold text-lg">
                    {qrEmployee.lastName} {qrEmployee.firstName} {qrEmployee.middleName || ''}
                  </p>
                  <p className="text-muted-foreground">Таб. №: {qrEmployee.personnelNumber}</p>
                  <p className="text-sm text-muted-foreground">QR: {qrEmployee.qrCode}</p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrDialogOpen(false)}>
              Закрыть
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Печать
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
