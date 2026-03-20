'use client'

import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Search, Plus, Edit, QrCode, Trash2, Printer, Download } from 'lucide-react'
import { QRCode } from '@/components/ui/qrcode'

interface Category {
  id: string
  name: string
}

interface Tool {
  id: string
  name: string
  inventoryNumber: string
  qrCode: string
  status: string
  notes: string | null
  category: { id: string; name: string }
  issuances: { id: string; employee: { lastName: string; firstName: string } }[]
}

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTool, setEditTool] = useState<Tool | null>(null)
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [qrTool, setQrTool] = useState<Tool | null>(null)
  const printRef = useRef<HTMLDivElement>(null)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    inventoryNumber: '',
    categoryId: '',
    notes: ''
  })

  useEffect(() => {
    fetchTools()
    fetchCategories()
  }, [search, statusFilter])

  const fetchTools = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      if (statusFilter !== 'all') params.set('status', statusFilter)
      
      const res = await fetch(`/api/tools?${params}`)
      const data = await res.json()
      setTools(data)
    } catch (error) {
      console.error('Failed to fetch tools:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      setCategories(data)
    } catch (error) {
      console.error('Failed to fetch categories:', error)
    }
  }

  const openCreateDialog = () => {
    setEditTool(null)
    setFormData({
      name: '',
      inventoryNumber: '',
      categoryId: categories[0]?.id || '',
      notes: ''
    })
    setDialogOpen(true)
  }

  const openEditDialog = (tool: Tool) => {
    setEditTool(tool)
    setFormData({
      name: tool.name,
      inventoryNumber: tool.inventoryNumber,
      categoryId: tool.category.id,
      notes: tool.notes || ''
    })
    setDialogOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      if (editTool) {
        const res = await fetch(`/api/tools/${editTool.id}`, {
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
        const res = await fetch('/api/tools', {
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
      fetchTools()
    } catch (error) {
      console.error('Failed to save tool:', error)
    }
  }

  const handleWriteOff = async (tool: Tool) => {
    if (!confirm(`Списать инструмент "${tool.name}"?`)) {
      return
    }
    
    try {
      const res = await fetch(`/api/tools/${tool.id}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Ошибка списания')
        return
      }
      
      fetchTools()
    } catch (error) {
      console.error('Failed to write off tool:', error)
    }
  }

  const openQrDialog = (tool: Tool) => {
    setQrTool(tool)
    setQrDialogOpen(true)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'IN_STOCK':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">На складе</Badge>
      case 'ISSUED':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Выдан</Badge>
      case 'WRITTEN_OFF':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Списан</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
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
          <title>QR-код инструмента</title>
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
    const headers = ['Название', 'Инв. номер', 'Категория', 'Статус', 'У кого', 'QR-код', 'Примечания']
    const rows = tools.map(tool => [
      tool.name,
      tool.inventoryNumber,
      tool.category.name,
      tool.status === 'IN_STOCK' ? 'На складе' : tool.status === 'ISSUED' ? 'Выдан' : 'Списан',
      tool.issuances[0] ? `${tool.issuances[0].employee.lastName} ${tool.issuances[0].employee.firstName}` : '-',
      tool.qrCode,
      tool.notes || ''
    ])
    
    const csvContent = [
      headers.join(';'),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(';'))
    ].join('\n')
    
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `tools_${new Date().toISOString().split('T')[0]}.csv`
    link.click()
  }

  const exportToJSON = () => {
    const data = tools.map(tool => ({
      name: tool.name,
      inventoryNumber: tool.inventoryNumber,
      category: tool.category.name,
      status: tool.status,
      currentHolder: tool.issuances[0] 
        ? `${tool.issuances[0].employee.lastName} ${tool.issuances[0].employee.firstName}` 
        : null,
      qrCode: tool.qrCode,
      notes: tool.notes
    }))
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `tools_${new Date().toISOString().split('T')[0]}.json`
    link.click()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Инструмент</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportToCSV} disabled={tools.length === 0}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={exportToJSON} disabled={tools.length === 0}>
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
                placeholder="Поиск по названию или инв. номеру..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="IN_STOCK">На складе</SelectItem>
                <SelectItem value="ISSUED">Выдан</SelectItem>
                <SelectItem value="WRITTEN_OFF">Списан</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[calc(100vh-350px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Название</TableHead>
                  <TableHead>Инв. номер</TableHead>
                  <TableHead>Категория</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead>У кого</TableHead>
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
                ) : tools.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Инструмент не найден
                    </TableCell>
                  </TableRow>
                ) : (
                  tools.map((tool) => (
                    <TableRow key={tool.id} className={tool.status === 'WRITTEN_OFF' ? 'opacity-50' : ''}>
                      <TableCell className="font-medium">{tool.name}</TableCell>
                      <TableCell>{tool.inventoryNumber}</TableCell>
                      <TableCell>{tool.category.name}</TableCell>
                      <TableCell>{getStatusBadge(tool.status)}</TableCell>
                      <TableCell>
                        {tool.issuances[0] ? (
                          <span>
                            {tool.issuances[0].employee.lastName} {tool.issuances[0].employee.firstName}
                          </span>
                        ) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openQrDialog(tool)}
                            title="QR-код"
                          >
                            <QrCode className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(tool)}
                            title="Редактировать"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          {tool.status !== 'WRITTEN_OFF' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleWriteOff(tool)}
                              title="Списать"
                            >
                              <Trash2 className="w-4 h-4" />
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
              {editTool ? 'Редактировать инструмент' : 'Добавить инструмент'}
            </DialogTitle>
            <DialogDescription>
              Заполните данные инструмента
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Название *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="inventoryNumber">Инвентарный номер *</Label>
                <Input
                  id="inventoryNumber"
                  value={formData.inventoryNumber}
                  onChange={(e) => setFormData({ ...formData, inventoryNumber: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Категория *</Label>
                <Select
                  value={formData.categoryId}
                  onValueChange={(value) => setFormData({ ...formData, categoryId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите категорию" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Примечания</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Отмена
              </Button>
              <Button type="submit">
                {editTool ? 'Сохранить' : 'Добавить'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR-код инструмента</DialogTitle>
          </DialogHeader>
          <div ref={printRef} className="qr-container text-center">
            {qrTool && (
              <>
                <div className="qr-code flex justify-center">
                  <div className="p-4 bg-white border rounded-lg inline-block">
                    <QRCode value={qrTool.qrCode} size={192} />
                  </div>
                </div>
                <div className="info space-y-1">
                  <p className="font-bold text-lg">{qrTool.name}</p>
                  <p className="text-muted-foreground">Инв. №: {qrTool.inventoryNumber}</p>
                  <p className="text-sm text-muted-foreground">QR: {qrTool.qrCode}</p>
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
