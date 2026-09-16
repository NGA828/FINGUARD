import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { employees, users } from '../database/connection';
import { nowIso, uuid } from '../common/utils';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

export interface CreateEmployeeDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  position: string;
  department: string;
}

/** Gestion des employés — réservée aux administrateurs (RBAC). */
@Injectable()
export class EmployeesService {
  constructor(
    private readonly audit: AuditService,
    private readonly notify: NotificationsService,
  ) {}

  list() {
    const { query, rowToCamel } = require('../database/connection');
    return query(
      `SELECT e.*, u.first_name, u.last_name, u.email, u.phone, u.is_active, u.last_login_at, u.created_at AS user_created_at
       FROM employees e
       JOIN users u ON u.id = e.user_id
       ORDER BY u.created_at DESC`,
    ).map((r: any) => {
      const row = rowToCamel(r);
      return {
        id: row.id,
        userId: row.userId,
        name: `${row.firstName} ${row.lastName}`,
        firstName: row.firstName,
        lastName: row.lastName,
        email: row.email,
        phone: row.phone,
        position: row.position,
        department: row.department,
        isActive: !!row.isActive,
        hiredAt: row.hiredAt,
        lastLoginAt: row.lastLoginAt,
      };
    });
  }

  async create(dto: CreateEmployeeDto, actorId: string, meta?: any) {
    const email = dto.email.toLowerCase().trim();
    if (users.first('email = ?', [email])) {
      throw new ConflictException('Un utilisateur existe déjà avec cet e-mail.');
    }
    const hashed = await bcrypt.hash(dto.password, 10);
    const now = nowIso();
    const user = users.insert({
      id: uuid(),
      email,
      password: hashed,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      phone: dto.phone ?? null,
      role: 'EMPLOYEE',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });
    employees.insert({
      id: uuid(),
      userId: user.id,
      position: dto.position,
      department: dto.department,
      hiredAt: now,
    });
    this.audit.record({
      userId: actorId,
      action: 'EMPLOYEE_CREATED',
      entity: 'EMPLOYEE',
      entityId: user.id,
      description: `Création de l'employé ${user.firstName} ${user.lastName} (${dto.position})`,
      ...meta,
    });
    return { id: user.id, email, name: `${user.firstName} ${user.lastName}`, position: dto.position };
  }

  async update(employeeId: string, dto: any, actorId: string, meta?: any) {
    const employee = employees.byId(employeeId);
    if (!employee) throw new NotFoundException('Employé introuvable.');
    const user = users.byId(employee.userId);

    const userPatch: any = { updatedAt: nowIso() };
    if (dto.firstName !== undefined) userPatch.firstName = dto.firstName;
    if (dto.lastName !== undefined) userPatch.lastName = dto.lastName;
    if (dto.phone !== undefined) userPatch.phone = dto.phone;
    if (dto.isActive !== undefined) userPatch.isActive = !!dto.isActive;
    if (dto.password) userPatch.password = await bcrypt.hash(dto.password, 10);
    users.update(employee.userId, userPatch);

    const empPatch: any = {};
    if (dto.position !== undefined) empPatch.position = dto.position;
    if (dto.department !== undefined) empPatch.department = dto.department;
    if (Object.keys(empPatch).length) employees.update(employeeId, empPatch);

    const actions: string[] = [];
    if (dto.isActive === true) actions.push('ACTIVATION');
    if (dto.isActive === false) actions.push('DEACTIVATION');
    if (dto.password) actions.push('PASSWORD_RESET');
    this.audit.record({
      userId: actorId,
      action: actions[0] || 'EMPLOYEE_UPDATED',
      entity: 'EMPLOYEE',
      entityId: employeeId,
      description: `Mise à jour de l'employé ${user.firstName} ${user.lastName}${actions.length ? ` (${actions.join(', ')})` : ''}`,
      ...meta,
    });
    if (dto.isActive === false) {
      this.notify.notify(
        user.id,
        'SECURITY_ALERT',
        'Compte désactivé',
        'Votre compte employé a été désactivé par un administrateur.',
      );
    }
    return this.list().find((e) => e.id === employeeId);
  }
}
