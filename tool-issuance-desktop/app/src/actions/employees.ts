'use server'

import { db } from '@/lib/db'
import { Employee, Tool } from '@prisma/client'

export interface EmployeeData {
  lastName: string
  firstName: string
  middleName?: string
  personnelNumber: string
  department?: string
}

export interface EmployeeWithTools extends Employee {
  issuances: {
    id: string
    tool: Tool
    issuedAt: Date
    expectedReturnDate: Date | null
  }[]
}

export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}

/**
 * Получить всех активных сотрудников
 * @returns Список сотрудников
 */
export async function getEmployees(): Promise<ActionResult<Employee[]>> {
  try {
    const employees = await db.employee.findMany({
      where: { isActive: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }]
    })
    return { success: true, data: employees }
  } catch (error) {
    console.error('Get employees error:', error)
    return { success: false, error: 'Ошибка при получении списка сотрудников' }
  }
}

/**
 * Получить сотрудника по ID
 * @param id - ID сотрудника
 * @returns Данные сотрудника
 */
export async function getEmployee(id: string): Promise<ActionResult<Employee>> {
  try {
    if (!id) {
      return { success: false, error: 'ID сотрудника не указан' }
    }

    const employee = await db.employee.findUnique({
      where: { id }
    })

    if (!employee) {
      return { success: false, error: 'Сотрудник не найден' }
    }

    return { success: true, data: employee }
  } catch (error) {
    console.error('Get employee error:', error)
    return { success: false, error: 'Ошибка при получении данных сотрудника' }
  }
}

/**
 * Получить сотрудника по QR-коду (для сканера)
 * @param qrCode - QR-код сотрудника
 * @returns Данные сотрудника
 */
export async function getEmployeeByQR(qrCode: string): Promise<ActionResult<Employee>> {
  try {
    if (!qrCode) {
      return { success: false, error: 'QR-код не указан' }
    }

    const employee = await db.employee.findUnique({
      where: { qrCode, isActive: true }
    })

    if (!employee) {
      return { success: false, error: 'Сотрудник с таким QR-кодом не найден' }
    }

    return { success: true, data: employee }
  } catch (error) {
    console.error('Get employee by QR error:', error)
    return { success: false, error: 'Ошибка при поиске сотрудника по QR-коду' }
  }
}

/**
 * Создать нового сотрудника
 * @param data - Данные сотрудника
 * @returns Созданный сотрудник
 */
export async function createEmployee(data: EmployeeData): Promise<ActionResult<Employee>> {
  try {
    // Валидация обязательных полей
    if (!data.lastName || !data.firstName || !data.personnelNumber) {
      return { success: false, error: 'Фамилия, имя и табельный номер обязательны' }
    }

    // Проверка уникальности табельного номера
    const existingEmployee = await db.employee.findUnique({
      where: { personnelNumber: data.personnelNumber }
    })

    if (existingEmployee) {
      return { success: false, error: 'Сотрудник с таким табельным номером уже существует' }
    }

    // Генерация уникального QR-кода
    let qrCode = crypto.randomUUID()
    let attempts = 0
    while (await db.employee.findUnique({ where: { qrCode } })) {
      qrCode = crypto.randomUUID()
      attempts++
      if (attempts > 10) {
        return { success: false, error: 'Не удалось сгенерировать уникальный QR-код' }
      }
    }

    const employee = await db.employee.create({
      data: {
        lastName: data.lastName,
        firstName: data.firstName,
        middleName: data.middleName || null,
        personnelNumber: data.personnelNumber,
        department: data.department || null,
        qrCode
      }
    })

    return { success: true, data: employee }
  } catch (error) {
    console.error('Create employee error:', error)
    return { success: false, error: 'Ошибка при создании сотрудника' }
  }
}

/**
 * Обновить данные сотрудника
 * @param id - ID сотрудника
 * @param data - Новые данные
 * @returns Обновленный сотрудник
 */
export async function updateEmployee(id: string, data: Partial<EmployeeData>): Promise<ActionResult<Employee>> {
  try {
    if (!id) {
      return { success: false, error: 'ID сотрудника не указан' }
    }

    // Проверка существования сотрудника
    const existingEmployee = await db.employee.findUnique({
      where: { id }
    })

    if (!existingEmployee) {
      return { success: false, error: 'Сотрудник не найден' }
    }

    // Проверка уникальности табельного номера при изменении
    if (data.personnelNumber && data.personnelNumber !== existingEmployee.personnelNumber) {
      const duplicatePersonnel = await db.employee.findUnique({
        where: { personnelNumber: data.personnelNumber }
      })
      if (duplicatePersonnel) {
        return { success: false, error: 'Сотрудник с таким табельным номером уже существует' }
      }
    }

    const employee = await db.employee.update({
      where: { id },
      data: {
        lastName: data.lastName,
        firstName: data.firstName,
        middleName: data.middleName || null,
        personnelNumber: data.personnelNumber,
        department: data.department || null
      }
    })

    return { success: true, data: employee }
  } catch (error) {
    console.error('Update employee error:', error)
    return { success: false, error: 'Ошибка при обновлении данных сотрудника' }
  }
}

/**
 * Мягкое удаление сотрудника (isActive = false)
 * @param id - ID сотрудника
 * @returns Результат операции
 */
export async function deleteEmployee(id: string): Promise<ActionResult> {
  try {
    if (!id) {
      return { success: false, error: 'ID сотрудника не указан' }
    }

    // Проверка существования сотрудника
    const existingEmployee = await db.employee.findUnique({
      where: { id }
    })

    if (!existingEmployee) {
      return { success: false, error: 'Сотрудник не найден' }
    }

    // Проверка наличия активных выдач
    const activeIssuances = await db.issuance.findFirst({
      where: { employeeId: id, returnedAt: null }
    })

    if (activeIssuances) {
      return { success: false, error: 'Невозможно удалить сотрудника с активными выдачами инструмента' }
    }

    await db.employee.update({
      where: { id },
      data: { isActive: false }
    })

    return { success: true }
  } catch (error) {
    console.error('Delete employee error:', error)
    return { success: false, error: 'Ошибка при удалении сотрудника' }
  }
}

/**
 * Получить сотрудника с выданными ему инструментами
 * @param id - ID сотрудника
 * @returns Сотрудник с инструментами
 */
export async function getEmployeeWithTools(id: string): Promise<ActionResult<EmployeeWithTools>> {
  try {
    if (!id) {
      return { success: false, error: 'ID сотрудника не указан' }
    }

    const employee = await db.employee.findUnique({
      where: { id, isActive: true },
      include: {
        issuances: {
          where: { returnedAt: null },
          include: {
            tool: true
          },
          orderBy: { issuedAt: 'desc' }
        }
      }
    })

    if (!employee) {
      return { success: false, error: 'Сотрудник не найден' }
    }

    return { success: true, data: employee as EmployeeWithTools }
  } catch (error) {
    console.error('Get employee with tools error:', error)
    return { success: false, error: 'Ошибка при получении данных сотрудника' }
  }
}
