import { Body, Controller, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, JwtAuthGuard, RequestMeta, Roles, RolesGuard } from '../common/guards';
import { TransactionsService, TX_TYPE_LABELS } from '../transactions/transactions.service';
import { AdministrationService } from './administration.service';
import { EmployeesService, CreateEmployeeDto } from '../employees/employees.service';
import { CustomersService } from '../customers/customers.service';
import { FraudService } from '../fraud/fraud.service';
import { ReportsService } from '../reports/reports.service';
import { AuditService } from '../audit/audit.service';
import { fraudAlerts, users } from '../database/connection';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEmployeeByAdminDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide.' }) email: string;
  @IsString() @MinLength(8, { message: 'Mot de passe : 8 caractères minimum.' }) password: string;
  @IsString() @IsNotEmpty() firstName: string;
  @IsString() @IsNotEmpty() lastName: string;
  @IsOptional() @IsString() phone?: string;
  @IsString() @IsNotEmpty({ message: 'Le poste est requis.' }) position: string;
  @IsString() @IsNotEmpty({ message: 'Le département est requis.' }) department: string;
}

export class UpdateEmployeeDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() position?: string;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() role?: string;
  @IsOptional() @IsString() @MinLength(8, { message: 'Mot de passe : 8 caractères minimum.' })
  password?: string;
}

export class UpdateConfigDto {
  @IsObject({ message: 'Un objet clé/valeur est attendu.' })
  values: Record<string, string>;
}

export class UpdateRuleDto {
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsNumber() @Min(0) @Max(100) points?: number;
  @IsOptional() @IsNumber() threshold?: number | null;
}

/**
 * Espace ADMINISTRATEUR — gestion globale du système : employés, rôles,
 * règles de fraude, configuration, audit, rapports systémiques.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly admin: AdministrationService,
    private readonly employees: EmployeesService,
    private readonly customersService: CustomersService,
    private readonly fraud: FraudService,
    private readonly reports: ReportsService,
    private readonly audit: AuditService,
    private readonly transactions: TransactionsService,
  ) {}

  // ------------------------------------------------------------------
  // Tableau de bord système
  // ------------------------------------------------------------------
  @Get('dashboard')
  dashboard() {
    const overview = this.reports.adminOverview();
    const fraudStats = this.fraud.stats();
    const pendingReviews = fraudAlerts.count("status IN ('OPEN','UNDER_REVIEW')");
    return {
      ...overview,
      fraud: fraudStats,
      pendingReviews,
      dailyStats: this.reports.daily(14),
      topCustomers: this.reports.topCustomers(5),
    };
  }

  // ------------------------------------------------------------------
  // Gestion des employés
  // ------------------------------------------------------------------
  @Get('employees')
  listEmployees() {
    return this.employees.list();
  }

  @Post('employees')
  createEmployee(@CurrentUser() user: any, @Body() dto: CreateEmployeeByAdminDto, @RequestMeta() meta: any) {
    return this.employees.create(dto as CreateEmployeeDto, user.sub, meta);
  }

  @Patch('employees/:id')
  updateEmployee(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateEmployeeDto, @RequestMeta() meta: any) {
    return this.employees.update(id, dto, user.sub, meta);
  }

  // ------------------------------------------------------------------
  // Supervision des clients
  // ------------------------------------------------------------------
  @Get('customers')
  listCustomers(@Query('q') q?: string) {
    return this.customersService.search(q);
  }

  @Get('customers/:id')
  customerDetail(@Param('id') id: string) {
    return this.customersService.getDetail(id);
  }

  @Post('customers/:id/toggle-active')
  toggleCustomer(@CurrentUser() user: any, @Param('id') id: string, @RequestMeta() meta: any) {
    return this.admin.toggleCustomerActive(id, user.sub, meta);
  }

  // ------------------------------------------------------------------
  // Fraude : statistiques, cas, règles
  // ------------------------------------------------------------------
  @Get('fraud/stats')
  fraudStats() {
    return this.fraud.stats();
  }

  @Get('fraud/cases')
  fraudCases(@Query('status') status?: string, @Query('level') level?: string) {
    return this.fraud.cases({ status, level });
  }

  @Get('fraud/rules')
  listRules() {
    return this.admin.listRules();
  }

  @Patch('fraud/rules/:id')
  updateRule(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateRuleDto, @RequestMeta() meta: any) {
    return this.admin.updateRule(id, dto, user.sub, meta);
  }

  // ------------------------------------------------------------------
  // Configuration du système
  // ------------------------------------------------------------------
  @Get('config')
  listConfig() {
    return this.admin.listConfig();
  }

  @Post('config')
  updateConfig(@CurrentUser() user: any, @Body() dto: UpdateConfigDto, @RequestMeta() meta: any) {
    return this.admin.updateConfig(dto.values, user.sub, meta);
  }

  // ------------------------------------------------------------------
  // Journaux d'audit
  // ------------------------------------------------------------------
  @Get('audit')
  auditLogsList(@Query() q: { q?: string; entity?: string; action?: string; limit?: number }) {
    return this.audit.list(q);
  }

  // ------------------------------------------------------------------
  // Rapports système
  // ------------------------------------------------------------------
  @Get('reports/summary')
  reportsSummary(@Query('days') days?: string) {
    return {
      overview: this.reports.adminOverview(),
      daily: this.reports.daily(Number(days) || 30),
      statusDistribution: this.reports.statusDistribution(),
      typeDistribution: this.reports.typeDistribution(),
      fraud: this.fraud.stats(),
      customersGrowth: this.reports.customersReport(),
      topCustomers: this.reports.topCustomers(10),
    };
  }

  /** Export CSV de toutes les transactions (filtres optionnels). */
  @Get('reports/transactions.csv')
  exportTransactionsCsv(
    @Query() q: { status?: string; type?: string; from?: string; to?: string },
    @Res() res: Response,
  ) {
    const rows = this.transactions.exportAll({ status: q.status, type: q.type, from: q.from, to: q.to });
    const header = 'Date;Référence;Type;Compte source;Compte cible;Montant (XAF);Statut';
    const lines = rows.map((t: any) =>
      [
        new Date(t.createdAt).toISOString(),
        t.reference,
        TX_TYPE_LABELS[t.type] ?? t.type,
        t.sourceNumber,
        t.targetNumber,
        t.amount,
        t.status,
      ].join(';'),
    );
    const csv = '\ufeff' + [header, ...lines].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=transactions-finguard.csv');
    return res.send(csv);
  }

  /** Export CSV du journal d'audit. */
  @Get('reports/audit.csv')
  exportAuditCsv(@Query() q: { entity?: string; action?: string }, @Res() res: Response) {
    const rows = this.audit.list({ entity: q.entity, action: q.action, limit: 500 });
    const header = 'Date;Utilisateur;Rôle;Action;Entité;Description;IP';
    const esc = (s: any) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const lines = rows.map((a: any) =>
      [
        new Date(a.createdAt).toISOString(),
        esc(a.user ? `${a.user.name} (${a.user.email})` : 'Système'),
        a.user?.role ?? '—',
        a.action,
        a.entity ?? '—',
        esc(a.description),
        a.ip ?? '—',
      ].join(';'),
    );
    const csv = '\ufeff' + [header, ...lines].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-finguard.csv');
    return res.send(csv);
  }
}
