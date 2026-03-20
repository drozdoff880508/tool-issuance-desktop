'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  Users, 
  Wrench, 
  Tags, 
  FileText, 
  ClipboardList,
  Settings
} from 'lucide-react'
import { LogoutButton } from '@/components/logout-button'

const navItems = [
  { href: '/admin', label: 'Обзор', icon: Settings },
  { href: '/admin/employees', label: 'Сотрудники', icon: Users },
  { href: '/admin/tools', label: 'Инструмент', icon: Wrench },
  { href: '/admin/categories', label: 'Категории', icon: Tags },
  { href: '/admin/issuances', label: 'Выдачи', icon: ClipboardList },
  { href: '/admin/reports', label: 'Отчёты', icon: FileText },
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-white border-r min-h-screen flex flex-col">
      <div className="p-6 border-b">
        <h1 className="text-xl font-bold">Панель администратора</h1>
      </div>
      
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || 
              (item.href !== '/admin' && pathname.startsWith(item.href))
            
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg transition-colors',
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
      
      <div className="p-4 border-t">
        <LogoutButton />
      </div>
    </aside>
  )
}
