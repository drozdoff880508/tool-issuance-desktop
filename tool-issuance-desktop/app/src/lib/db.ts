import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

// Путь к файлу базы данных
const getDbPath = () => {
  // В production используем путь из переменной окружения или папку data
  const dataDir = process.env.DATA_DIR || path.join(process.cwd(), 'data')
  
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true })
  }
  
  return path.join(dataDir, 'data.json')
}

// Типы данных
interface Employee {
  id: string
  lastName: string
  firstName: string
  middleName: string | null
  personnelNumber: string
  department: string | null
  qrCode: string
  isActive: boolean
  createdAt: string
}

interface ToolCategory {
  id: string
  name: string
  description: string | null
}

interface Tool {
  id: string
  name: string
  inventoryNumber: string
  categoryId: string
  qrCode: string
  status: 'IN_STOCK' | 'ISSUED' | 'WRITTEN_OFF'
  quantity: number
  notes: string | null
  createdAt: string
}

interface Issuance {
  id: string
  toolId: string
  employeeId: string
  quantity: number
  issuedAt: string
  issuedBy: string
  expectedReturnDate: string | null
  returnedAt: string | null
  returnedBy: string | null
  notes: string | null
  returnNotes: string | null
  isOverdue: boolean
}

interface User {
  id: string
  username: string
  password: string
  role: 'ADMIN' | 'STOREKEEPER'
  name: string
  isActive: boolean
  createdAt: string
}

interface Database {
  employees: Employee[]
  categories: ToolCategory[]
  tools: Tool[]
  issuances: Issuance[]
  users: User[]
}

// Инициализация базы данных с начальными данными
const initDatabase = (): Database => ({
  employees: [],
  categories: [
    { id: 'cat1', name: 'Обычный', description: 'Обычный инструмент' },
    { id: 'cat2', name: 'Особо ценный', description: 'Особо ценный инструмент' }
  ],
  tools: [],
  issuances: [],
  users: [
    {
      id: 'user1',
      username: 'admin',
      password: '$2a$10$rQZ9QxQxQxQxQxQxQxQxQOZJ9J9J9J9J9J9J9J9J9J9J9J9J9J9J9', // admin123
      role: 'ADMIN',
      name: 'Администратор',
      isActive: true,
      createdAt: new Date().toISOString()
    },
    {
      id: 'user2',
      username: 'storekeeper',
      password: '$2a$10$rQZ9QxQxQxQxQxQxQxQxQOZJ9J9J9J9J9J9J9J9J9J9J9J9J9J9J9', // store123
      role: 'STOREKEEPER',
      name: 'Кладовщик',
      isActive: true,
      createdAt: new Date().toISOString()
    }
  ]
})

// Хеширование пароля (простая версия для совместимости)
const hashPassword = (password: string): string => {
  const bcrypt = require('bcryptjs')
  return bcrypt.hashSync(password, 10)
}

// Инициализация пользователей с правильными хешами
const initUsers = (): User[] => [
  {
    id: 'user1',
    username: 'admin',
    password: hashPassword('admin123'),
    role: 'ADMIN',
    name: 'Администратор',
    isActive: true,
    createdAt: new Date().toISOString()
  },
  {
    id: 'user2',
    username: 'storekeeper',
    password: hashPassword('store123'),
    role: 'STOREKEEPER',
    name: 'Кладовщик',
    isActive: true,
    createdAt: new Date().toISOString()
  }
]

// Чтение базы данных
const readDatabase = (): Database => {
  try {
    const dbPath = getDbPath()
    
    if (!fs.existsSync(dbPath)) {
      const initialDb = initDatabase()
      initialDb.users = initUsers()
      fs.writeFileSync(dbPath, JSON.stringify(initialDb, null, 2))
      return initialDb
    }
    
    const data = fs.readFileSync(dbPath, 'utf-8')
    const parsed = JSON.parse(data)
    
    // Миграция: добавляем quantity если отсутствует
    if (parsed.tools) {
      parsed.tools = parsed.tools.map((t: Tool) => ({
        ...t,
        quantity: t.quantity ?? 1
      }))
    }
    if (parsed.issuances) {
      parsed.issuances = parsed.issuances.map((i: Issuance) => ({
        ...i,
        quantity: i.quantity ?? 1
      }))
    }
    
    return parsed
  } catch (error) {
    console.error('Error reading database:', error)
    const initialDb = initDatabase()
    initialDb.users = initUsers()
    return initialDb
  }
}

// Запись базы данных
const writeDatabase = (data: Database): void => {
  try {
    const dbPath = getDbPath()
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2))
  } catch (error) {
    console.error('Error writing database:', error)
  }
}

// Подсчёт выданного количества для инструмента
const getIssuedQuantity = (toolId: string, issuances: Issuance[]): number => {
  return issuances
    .filter(i => i.toolId === toolId && i.returnedAt === null)
    .reduce((sum, i) => sum + i.quantity, 0)
}

// Клиент базы данных с методами CRUD
export const db = {
  // Employees
  employee: {
    findMany: async (options?: { where?: Partial<Employee> & { isActive?: boolean }; include?: { issuances?: { where?: { returnedAt: null }; include?: { tool: { include?: { category: boolean } } } } } }): Promise<Employee[]> => {
      const data = readDatabase()
      let result = data.employees
      if (options?.where) {
        result = result.filter(e => {
          for (const key in options.where) {
            if (e[key as keyof Employee] !== options.where[key as keyof typeof options.where]) {
              return false
            }
          }
          return true
        })
      }
      
      if (options?.include?.issuances) {
        return result.map(e => {
          let employeeIssuances = data.issuances.filter(i => i.employeeId === e.id)
          if (options.include?.issuances?.where?.returnedAt === null) {
            employeeIssuances = employeeIssuances.filter(i => i.returnedAt === null)
          }
          return {
            ...e,
            issuances: employeeIssuances.map(i => {
              const tool = data.tools.find(t => t.id === i.toolId)
              const category = tool ? data.categories.find(c => c.id === tool.categoryId) : null
              return {
                ...i,
                tool: tool ? { ...tool, category } : undefined
              }
            })
          }
        }) as Employee[]
      }
      
      return result
    },
    
    findUnique: async (options: { where: { id?: string; qrCode?: string; personnelNumber?: string }; include?: { issuances?: { where?: { returnedAt: null }; include?: { tool: { include?: { category: boolean } } } } } }): Promise<Employee | null> => {
      const data = readDatabase()
      let employee: Employee | undefined
      if (options.where.id) {
        employee = data.employees.find(e => e.id === options.where.id)
      } else if (options.where.qrCode) {
        employee = data.employees.find(e => e.qrCode === options.where.qrCode)
      } else if (options.where.personnelNumber) {
        employee = data.employees.find(e => e.personnelNumber === options.where.personnelNumber)
      }
      if (!employee) return null
      
      if (options.include?.issuances) {
        let employeeIssuances = data.issuances.filter(i => i.employeeId === employee!.id)
        if (options.include.issuances.where?.returnedAt === null) {
          employeeIssuances = employeeIssuances.filter(i => i.returnedAt === null)
        }
        return {
          ...employee,
          issuances: employeeIssuances.map(i => {
            const tool = data.tools.find(t => t.id === i.toolId)
            const category = tool ? data.categories.find(c => c.id === tool.categoryId) : null
            return {
              ...i,
              tool: tool ? { ...tool, category } : undefined
            }
          })
        } as Employee
      }
      
      return employee
    },
    
    findFirst: async (options?: { where?: Partial<Employee> }): Promise<Employee | null> => {
      const data = readDatabase()
      if (!options?.where) return data.employees[0] || null
      return data.employees.find(e => {
        for (const key in options.where) {
          if (e[key as keyof Employee] !== options.where[key as keyof typeof options.where]) {
            return false
          }
        }
        return true
      }) || null
    },
    
    create: async (options: { data: Omit<Employee, 'id' | 'createdAt'> & { id?: string } }): Promise<Employee> => {
      const data = readDatabase()
      const newEmployee: Employee = {
        ...options.data,
        id: options.data.id || uuidv4(),
        createdAt: new Date().toISOString()
      }
      data.employees.push(newEmployee)
      writeDatabase(data)
      return newEmployee
    },
    
    update: async (options: { where: { id: string }; data: Partial<Employee> }): Promise<Employee> => {
      const data = readDatabase()
      const index = data.employees.findIndex(e => e.id === options.where.id)
      if (index === -1) throw new Error('Employee not found')
      data.employees[index] = { ...data.employees[index], ...options.data }
      writeDatabase(data)
      return data.employees[index]
    },
    
    count: async (options?: { where?: Partial<Employee> }): Promise<number> => {
      const data = readDatabase()
      if (!options?.where) return data.employees.length
      return data.employees.filter(e => {
        for (const key in options.where) {
          if (e[key as keyof Employee] !== options.where[key as keyof typeof options.where]) {
            return false
          }
        }
        return true
      }).length
    }
  },
  
  // Categories
  toolCategory: {
    findMany: async (): Promise<ToolCategory[]> => {
      const data = readDatabase()
      return data.categories
    },
    
    findUnique: async (options: { where: { id?: string; name?: string } }): Promise<ToolCategory | null> => {
      const data = readDatabase()
      if (options.where.id) {
        return data.categories.find(c => c.id === options.where.id) || null
      }
      if (options.where.name) {
        return data.categories.find(c => c.name === options.where.name) || null
      }
      return null
    },
    
    create: async (options: { data: Omit<ToolCategory, 'id'> }): Promise<ToolCategory> => {
      const data = readDatabase()
      const newCategory: ToolCategory = { ...options.data, id: uuidv4() }
      data.categories.push(newCategory)
      writeDatabase(data)
      return newCategory
    },
    
    update: async (options: { where: { id: string }; data: Partial<ToolCategory> }): Promise<ToolCategory> => {
      const data = readDatabase()
      const index = data.categories.findIndex(c => c.id === options.where.id)
      if (index === -1) throw new Error('Category not found')
      data.categories[index] = { ...data.categories[index], ...options.data }
      writeDatabase(data)
      return data.categories[index]
    },
    
    delete: async (options: { where: { id: string } }): Promise<ToolCategory> => {
      const data = readDatabase()
      const index = data.categories.findIndex(c => c.id === options.where.id)
      if (index === -1) throw new Error('Category not found')
      const deleted = data.categories.splice(index, 1)[0]
      writeDatabase(data)
      return deleted
    }
  },
  
  // Alias for toolCategory
  category: {
    findMany: async (): Promise<ToolCategory[]> => {
      const data = readDatabase()
      return data.categories
    },
    
    findUnique: async (options: { where: { id?: string; name?: string } }): Promise<ToolCategory | null> => {
      const data = readDatabase()
      if (options.where.id) {
        return data.categories.find(c => c.id === options.where.id) || null
      }
      if (options.where.name) {
        return data.categories.find(c => c.name === options.where.name) || null
      }
      return null
    }
  },
  
  // Tools
  tool: {
    findMany: async (options?: { where?: Partial<Tool> & { OR?: Array<{ name?: { contains: string }; inventoryNumber?: { contains: string } }> }; include?: { category?: boolean; issuances?: { where?: { returnedAt: null }; include?: { employee?: boolean } } }; orderBy?: { name?: 'asc' | 'desc'; createdAt?: 'asc' | 'desc' } }): Promise<(Tool & { category?: ToolCategory; issuances?: (Issuance & { employee?: Employee })[]; issuedQuantity?: number; availableQuantity?: number })[]> => {
      const data = readDatabase()
      let result = data.tools
      
      if (options?.where) {
        result = result.filter(t => {
          // Простые условия
          for (const key in options.where) {
            if (key !== 'OR' && t[key as keyof Tool] !== options.where[key as keyof typeof options.where]) {
              return false
            }
          }
          // OR условия
          if (options.where.OR) {
            const matchesOR = options.where.OR.some(condition => {
              if (condition.name?.contains) {
                return t.name.toLowerCase().includes(condition.name.contains.toLowerCase())
              }
              if (condition.inventoryNumber?.contains) {
                return t.inventoryNumber.toLowerCase().includes(condition.inventoryNumber.contains.toLowerCase())
              }
              return false
            })
            if (!matchesOR) return false
          }
          return true
        })
      }
      
      // Сортировка
      if (options?.orderBy) {
        if (options.orderBy.name === 'asc') {
          result = [...result].sort((a, b) => a.name.localeCompare(b.name))
        } else if (options.orderBy.name === 'desc') {
          result = [...result].sort((a, b) => b.name.localeCompare(a.name))
        }
        if (options.orderBy.createdAt === 'desc') {
          result = [...result].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        }
      }
      
      return result.map(t => {
        const tool: Tool & { category?: ToolCategory; issuances?: (Issuance & { employee?: Employee })[]; issuedQuantity?: number; availableQuantity?: number } = { ...t }
        
        const issuedQty = getIssuedQuantity(t.id, data.issuances)
        tool.issuedQuantity = issuedQty
        tool.availableQuantity = t.quantity - issuedQty
        
        if (options?.include?.category) {
          tool.category = data.categories.find(c => c.id === t.categoryId)
        }
        if (options?.include?.issuances) {
          let issuances = data.issuances.filter(i => i.toolId === t.id)
          if (options.include.issuances.where?.returnedAt === null) {
            issuances = issuances.filter(i => i.returnedAt === null)
          }
          tool.issuances = issuances.map(i => ({
            ...i,
            employee: data.employees.find(e => e.id === i.employeeId)
          })) as (Issuance & { employee?: Employee })[]
        }
        return tool
      })
    },
    
    findUnique: async (options: { where: { id?: string; qrCode?: string; inventoryNumber?: string }; include?: { category?: boolean; issuances?: { where?: { returnedAt: null }; include?: { employee?: boolean } } } }): Promise<(Tool & { category?: ToolCategory; issuances?: (Issuance & { employee?: Employee })[]; issuedQuantity?: number; availableQuantity?: number }) | null> => {
      const data = readDatabase()
      let tool: Tool | undefined
      if (options.where.id) {
        tool = data.tools.find(t => t.id === options.where.id)
      } else if (options.where.qrCode) {
        tool = data.tools.find(t => t.qrCode === options.where.qrCode)
      } else if (options.where.inventoryNumber) {
        tool = data.tools.find(t => t.inventoryNumber === options.where.inventoryNumber)
      }
      if (!tool) return null
      
      const issuedQty = getIssuedQuantity(tool.id, data.issuances)
      
      const result: Tool & { category?: ToolCategory; issuances?: (Issuance & { employee?: Employee })[]; issuedQuantity?: number; availableQuantity?: number } = {
        ...tool,
        issuedQuantity: issuedQty,
        availableQuantity: tool.quantity - issuedQty
      }
      
      if (options.include?.category) {
        result.category = data.categories.find(c => c.id === tool!.categoryId)
      }
      if (options.include?.issuances) {
        let issuances = data.issuances.filter(i => i.toolId === tool!.id)
        if (options.include.issuances.where?.returnedAt === null) {
          issuances = issuances.filter(i => i.returnedAt === null)
        }
        result.issuances = issuances.map(i => ({
          ...i,
          employee: options.include?.issuances?.include?.employee ? data.employees.find(e => e.id === i.employeeId) : undefined
        })) as (Issuance & { employee?: Employee })[]
      }
      return result
    },
    
    findFirst: async (options?: { where?: Partial<Tool> }): Promise<Tool | null> => {
      const data = readDatabase()
      if (!options?.where) return data.tools[0] || null
      return data.tools.find(t => {
        for (const key in options.where) {
          if (t[key as keyof Tool] !== options.where[key as keyof typeof options.where]) {
            return false
          }
        }
        return true
      }) || null
    },
    
    create: async (options: { data: Omit<Tool, 'id' | 'createdAt'> }): Promise<Tool> => {
      const data = readDatabase()
      const newTool: Tool = {
        ...options.data,
        id: uuidv4(),
        createdAt: new Date().toISOString()
      }
      data.tools.push(newTool)
      writeDatabase(data)
      return newTool
    },
    
    update: async (options: { where: { id: string }; data: Partial<Tool>; include?: { category?: boolean } }): Promise<Tool & { category?: ToolCategory }> => {
      const data = readDatabase()
      const index = data.tools.findIndex(t => t.id === options.where.id)
      if (index === -1) throw new Error('Tool not found')
      data.tools[index] = { ...data.tools[index], ...options.data }
      writeDatabase(data)
      const result: Tool & { category?: ToolCategory } = { ...data.tools[index] }
      if (options.include?.category) {
        result.category = data.categories.find(c => c.id === result.categoryId)
      }
      return result
    },
    
    count: async (options?: { where?: Partial<Tool> }): Promise<number> => {
      const data = readDatabase()
      if (!options?.where) return data.tools.length
      return data.tools.filter(t => {
        for (const key in options.where) {
          if (t[key as keyof Tool] !== options.where[key as keyof typeof options.where]) {
            return false
          }
        }
        return true
      }).length
    }
  },
  
  // Issuances
  issuance: {
    findMany: async (options?: { where?: Partial<Issuance> & { OR?: Array<{ employeeId?: string; toolId?: string }> }; include?: { tool?: { include?: { category?: boolean } }; employee?: boolean }; orderBy?: { issuedAt: 'desc' | 'asc' }; take?: number }): Promise<(Issuance & { tool?: Tool & { category?: ToolCategory }; employee?: Employee })[]> => {
      const data = readDatabase()
      let result = data.issuances
      
      if (options?.where) {
        result = result.filter(i => {
          for (const key in options.where) {
            if (key !== 'OR' && i[key as keyof Issuance] !== options.where[key as keyof typeof options.where]) {
              return false
            }
          }
          return true
        })
      }
      
      if (options?.orderBy?.issuedAt === 'desc') {
        result = [...result].sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
      }
      
      if (options?.take) {
        result = result.slice(0, options.take)
      }
      
      return result.map(i => {
        const issuance: Issuance & { tool?: Tool & { category?: ToolCategory }; employee?: Employee } = { ...i }
        if (options?.include?.tool) {
          const tool = data.tools.find(t => t.id === i.toolId)
          issuance.tool = tool as Tool & { category?: ToolCategory }
          if (options.include.tool.include?.category && tool) {
            issuance.tool.category = data.categories.find(c => c.id === tool.categoryId)
          }
        }
        if (options?.include?.employee) {
          issuance.employee = data.employees.find(e => e.id === i.employeeId)
        }
        return issuance
      })
    },
    
    findFirst: async (options?: { where?: Partial<Issuance> }): Promise<Issuance | null> => {
      const data = readDatabase()
      if (!options?.where) return data.issuances[0] || null
      return data.issuances.find(i => {
        for (const key in options.where) {
          if (i[key as keyof Issuance] !== options.where[key as keyof typeof options.where]) {
            return false
          }
        }
        return true
      }) || null
    },
    
    create: async (options: { data: Omit<Issuance, 'id'>; include?: { tool?: { include?: { category?: boolean } }; employee?: boolean } }): Promise<Issuance & { tool?: Tool & { category?: ToolCategory }; employee?: Employee }> => {
      const data = readDatabase()
      const newIssuance: Issuance = { ...options.data, id: uuidv4() }
      data.issuances.push(newIssuance)
      writeDatabase(data)
      
      const result: Issuance & { tool?: Tool & { category?: ToolCategory }; employee?: Employee } = { ...newIssuance }
      if (options.include?.tool) {
        const tool = data.tools.find(t => t.id === newIssuance.toolId)
        result.tool = tool as Tool & { category?: ToolCategory }
        if (options.include.tool.include?.category && tool) {
          result.tool.category = data.categories.find(c => c.id === tool.categoryId)
        }
      }
      if (options.include?.employee) {
        result.employee = data.employees.find(e => e.id === newIssuance.employeeId)
      }
      return result
    },
    
    update: async (options: { where: { id: string }; data: Partial<Issuance> }): Promise<Issuance> => {
      const data = readDatabase()
      const index = data.issuances.findIndex(i => i.id === options.where.id)
      if (index === -1) throw new Error('Issuance not found')
      data.issuances[index] = { ...data.issuances[index], ...options.data }
      writeDatabase(data)
      return data.issuances[index]
    },
    
    count: async (options?: { where?: Partial<Issuance> }): Promise<number> => {
      const data = readDatabase()
      if (!options?.where) return data.issuances.length
      return data.issuances.filter(i => {
        for (const key in options.where) {
          if (i[key as keyof Issuance] !== options.where[key as keyof typeof options.where]) {
            return false
          }
        }
        return true
      }).length
    }
  },
  
  // Users
  user: {
    findMany: async (): Promise<User[]> => {
      const data = readDatabase()
      return data.users
    },
    
    findUnique: async (options: { where: { id?: string; username?: string; isActive?: boolean } }): Promise<User | null> => {
      const data = readDatabase()
      if (options.where.id) {
        const user = data.users.find(u => u.id === options.where.id)
        if (user && options.where.isActive !== undefined && user.isActive !== options.where.isActive) {
          return null
        }
        return user || null
      }
      if (options.where.username) {
        const user = data.users.find(u => u.username === options.where.username)
        if (user && options.where.isActive !== undefined && user.isActive !== options.where.isActive) {
          return null
        }
        return user || null
      }
      return null
    },
    
    create: async (options: { data: Omit<User, 'id' | 'createdAt'> }): Promise<User> => {
      const data = readDatabase()
      const newUser: User = {
        ...options.data,
        id: uuidv4(),
        createdAt: new Date().toISOString()
      }
      data.users.push(newUser)
      writeDatabase(data)
      return newUser
    },
    
    update: async (options: { where: { id: string }; data: Partial<User> }): Promise<User> => {
      const data = readDatabase()
      const index = data.users.findIndex(u => u.id === options.where.id)
      if (index === -1) throw new Error('User not found')
      data.users[index] = { ...data.users[index], ...options.data }
      writeDatabase(data)
      return data.users[index]
    }
  },
  
  // Transaction (simplified)
  $transaction: async <T>(callback: (tx: typeof db) => Promise<T>): Promise<T> => {
    return callback(db)
  }
}
