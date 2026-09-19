import { Body, Controller, Get, NotFoundException, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser, JwtAuthGuard, RequestMeta, Roles, RolesGuard } from '../common/guards';
import { AccountsService } from '../accounts/accounts.service';
import { TransactionsService, TX_TYPE_LABELS } from '../transactions/transactions.service';
import { DisputesService } from '../disputes/disputes.service';
import { AlertsService } from '../alerts/alerts.service';
import { CustomersService, CreateCustomerDto } from '../customers/customers.service';
import { FraudService } from '../fraud/fraud.service';
import { ReportsService } from '../reports/reports.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';
import { accounts as accountsRepo, customers, fraudAlerts, query, users } from '../database/connection';
import { nowIso } from '../common/utils';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCustomerByEmployeeDto {
  @IsEmail({}, { message: 'Adresse e-mail invalide.' }) email: string;
  @IsString() @MinLength(8, { message: 'Mot de passe : 8 caractères minimum.' }) password: string;
  @IsString() @IsNotEmpty() firstName: string;
  @IsString() @IsNotEmpty() lastName: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsNumber() @Min(0) initialDeposit?: number;
}

export class OpenAccountDto {
  @IsString() @IsNotEmpty() customerId: string;
  @IsOptional() @IsNumber() @Min(0) dailyLimit?: number;
  @IsOptional() @IsNumber() @Min(0) perTxLimit?: number;
}

export class UpdateAccountDto {
  @IsOptional() @IsNumber() @Min(1) dailyLimit?: number;
  @IsOptional() @IsNumber() @Min(1) perTxLimit?: number;
}

export class FreezeDto {
  @IsOptional() @IsString() reason?: string;
}

export class ReviewDto {
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() reason?: string;
}

export class DisputeStatusDto {
  @IsIn(['SUBMITTED', 'UNDER_REVIEW', 'INVESTIGATING', 'RESOLVED', 'REJECTED', 'CLOSED'])
  status: string;
}

export class DisputeNoteDto {
  @IsString() @IsNotEmpty({ message: 'Le contenu de la note est requis.' }) content: string;
}

export class ResolveDisputeDto {
  @IsString() @IsNotEmpty({ message: 'La résolution est requise.' }) resolution: string;
  @IsOptional() @IsBoolean() reject?: boolean;
}

export class ResolveAlertDto {
  @IsIn(['APPROVED', 'REJECTED', 'HELD']) resolution: string;
  @IsOptional() @IsString() notes?: string;
}

export class SimulateFraudDto {
  @IsString() @IsNotEmpty({ message: 'Le compte est requis.' }) accountId: string;
  @IsIn(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT'], { message: 'Type de transaction invalide.' })
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'PAYMENT';
  @IsNumber({}, { message: 'Le montant doit être un nombre.' })
  @Min(1, { message: 'Le montant doit être supérieur à 0.' })
  @Max(100000000, { message: 'Montant trop élevé.' })
  amount: number;
}

/**
 * Espace EMPLOYÉ — opérations bancaires, revue des transactions suspectes,
 * litiges, gestion des clients et comptes.
 */
@Controller('employee')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('EMPLOYEE', 'ADMIN')
export class EmployeeController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly transactions: TransactionsService,
    private readonly disputes: DisputesService,
    private readonly alerts: AlertsService,
    private readonly customersService: CustomersService,
    private readonly fraud: FraudService,
    private readonly reports: ReportsService,
    private readonly notify: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------
  // Tableau de bord opérationnel
  // ------------------------------------------------------------------
  @Get('dashboard')
  dashboard() {
    const totalCustomers = customers.count();
    const activeAccounts = query("SELECT COUNT(*) AS c FROM accounts WHERE status = 'ACTIVE'")[0].c;
    const txToday = query(
      `SELECT COUNT(*) AS count, COALESCE(SUM(amount),0) AS volume
       FROM transactions WHERE created_at >= UTC_DATE() AND created_at < DATE_ADD(UTC_DATE(), INTERVAL 1 DAY)`,
    )[0];
    const pendingReview = query(
      `SELECT COUNT(*) AS c FROM transactions WHERE status IN ('PENDING','UNDER_REVIEW')`,
    )[0].c;
    const suspicious = fraudAlerts.count("status IN ('OPEN','UNDER_REVIEW','ESCALATED')");
    const openDisputes = query(
      `SELECT COUNT(*) AS c FROM disputes WHERE status IN ('SUBMITTED','UNDER_REVIEW','INVESTIGATING')`,
    )[0].c;
    const recentTransactions = query(
      `SELECT t.*, a.account_number, u.first_name, u.last_name
       FROM transactions t
       LEFT JOIN accounts a ON a.id = t.source_account_id OR a.id = t.target_account_id
       LEFT JOIN customers c ON c.id = a.customer_id
       LEFT JOIN users u ON u.id = c.user_id
       ORDER BY t.created_at DESC LIMIT 8`,
    ).map((t: any) => ({
      ...t,
      amount: Number(t.amount),
      customerName: t.first_name ? `${t.first_name} ${t.last_name}` : null,
    }));
    const recentAlerts = this.alerts.list({}).slice(0, 5);
    return {
      stats: {
        totalCustomers,
        activeAccounts: Number(activeAccounts),
        txTodayCount: Number(txToday.count),
        txTodayVolume: Number(txToday.volume),
        pendingReview: Number(pendingReview),
        suspicious: Number(suspicious),
        openDisputes: Number(openDisputes),
      },
      recentTransactions,
      recentAlerts,
      dailyStats: this.reports.daily(7),
    };
  }

  // ------------------------------------------------------------------
  // Gestion des clients
  // ------------------------------------------------------------------
  @Get('customers')
  searchCustomers(@Query('q') q?: string) {
    return this.customersService.search(q);
  }

  @Get('customers/:id')
  customerDetail(@Param('id') id: string) {
    return this.customersService.getDetail(id);
  }

  @Post('customers')
  createCustomer(@CurrentUser() user: any, @Body() dto: CreateCustomerByEmployeeDto, @RequestMeta() meta: any) {
    return this.customersService.create(dto as CreateCustomerDto, user.sub, meta);
  }

  @Patch('customers/:id')
  updateCustomer(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: any, @RequestMeta() meta: any) {
    return this.customersService.update(id, dto, user.sub, meta);
  }

  // ------------------------------------------------------------------
  // Gestion des comptes
  // ------------------------------------------------------------------
  @Get('accounts')
  searchAccounts(@Query('q') q?: string) {
    return this.accounts.search(q);
  }

  @Get('accounts/:id')
  accountDetail(@Param('id') id: string) {
    return this.accounts.getWithCustomer(id);
  }

  @Post('accounts')
  openAccount(@CurrentUser() user: any, @Body() dto: OpenAccountDto, @RequestMeta() meta: any) {
    return this.accounts.openAccount(dto.customerId, dto, user.sub, meta);
  }

  @Post('accounts/:id/freeze')
  freeze(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: FreezeDto, @RequestMeta() meta: any) {
    return this.accounts.freeze(id, dto.reason, user.sub, meta);
  }

  @Patch('accounts/:id')
  updateAccount(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: UpdateAccountDto, @RequestMeta() meta: any) {
    return this.accounts.updateLimits(id, dto, user.sub, meta);
  }

  @Post('accounts/:id/unfreeze')
  unfreeze(@CurrentUser() user: any, @Param('id') id: string, @RequestMeta() meta: any) {
    return this.accounts.unfreeze(id, user.sub, meta);
  }

  @Get('accounts/:id/statement')
  accountStatement(@Param('id') id: string, @Res() res: Response) {
    const { account, rows } = this.transactions.statement(id);
    const header = 'Date;Référence;Type;Description;Sens;Montant (XAF);Statut';
    const lines = rows.map((t: any) =>
      [
        new Date(t.createdAt).toISOString(),
        t.reference,
        TX_TYPE_LABELS[t.type] ?? t.type,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        t.direction === 'DEBIT' ? 'Débit' : 'Crédit',
        t.amount,
        t.status,
      ].join(';'),
    );
    const csv = '\ufeff' + [header, ...lines].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=releve-${account.accountNumber}.csv`);
    return res.send(csv);
  }

  // ------------------------------------------------------------------
  // Transactions
  // ------------------------------------------------------------------
  @Get('transactions')
  allTransactions(@Query() q: any) {
    return this.transactions.listAll(q);
  }

  @Get('transactions/:id')
  transactionDetail(@Param('id') id: string) {
    return this.transactions.getDetail(id);
  }

  @Post('transactions/:id/approve')
  approve(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ReviewDto, @RequestMeta() meta: any) {
    return this.transactions.employeeApprove(user.sub, id, dto.notes, meta);
  }

  @Post('transactions/:id/reject')
  reject(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ReviewDto, @RequestMeta() meta: any) {
    return this.transactions.employeeReject(user.sub, id, dto.reason, meta);
  }

  @Post('transactions/:id/hold')
  hold(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ReviewDto, @RequestMeta() meta: any) {
    return this.transactions.employeeHold(user.sub, id, dto.notes, meta);
  }

  /**
   * Simulateur de fraude : évalue le score de risque d'une transaction
   * fictive sans aucun mouvement de fonds ni écriture en base.
   */
  @Post('transactions/simulate')
  async simulateFraud(@CurrentUser() user: any, @Body() dto: SimulateFraudDto, @RequestMeta() meta: any) {
    const account = accountsRepo.byId(dto.accountId);
    if (!account) throw new NotFoundException('Compte introuvable.');
    const result = await this.fraud.analyzeWithAi(
      { id: 'simulation', amount: dto.amount, type: dto.type, createdAt: nowIso(), sourceAccountId: account.id },
      account,
    );
    this.audit.record({
      userId: user.sub,
      action: 'FRAUD_SIMULATION',
      entity: 'ACCOUNT',
      entityId: account.id,
      description: `Simulation de fraude (${dto.type}, ${dto.amount} XAF) sur le compte ${account.accountNumber} → risque ${result.riskLevel}`,
      ...meta,
    });
    return { simulation: true, amount: dto.amount, type: dto.type, accountNumber: account.accountNumber, analysis: result };
  }

  // ------------------------------------------------------------------
  // Transactions suspectes & alertes
  // ------------------------------------------------------------------
  @Get('suspicious')
  suspicious() {
    return this.transactions.suspicious();
  }

  @Get('alerts')
  alertsList(@Query('status') status?: string) {
    return this.alerts.list({ status });
  }

  @Post('alerts/:id/resolve')
  resolveAlert(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ResolveAlertDto, @RequestMeta() meta: any) {
    return this.alerts.resolve(user.sub, id, dto, meta);
  }

  @Post('alerts/:id/escalate')
  escalateAlert(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ReviewDto, @RequestMeta() meta: any) {
    return this.alerts.escalate(user.sub, id, dto.notes, meta);
  }

  // ------------------------------------------------------------------
  // Litiges
  // ------------------------------------------------------------------
  @Get('disputes')
  disputesList(@Query('status') status?: string) {
    return this.disputes.listAll({ status });
  }

  @Get('disputes/:id')
  disputeDetail(@Param('id') id: string) {
    return this.disputes.getDetail(id);
  }

  @Post('disputes/:id/status')
  disputeStatus(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: DisputeStatusDto, @RequestMeta() meta: any) {
    return this.disputes.updateStatus(user.sub, id, dto.status, meta);
  }

  @Post('disputes/:id/notes')
  disputeNote(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: DisputeNoteDto) {
    return this.disputes.addNote(user.sub, id, dto.content);
  }

  @Post('disputes/:id/resolve')
  disputeResolve(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ResolveDisputeDto, @RequestMeta() meta: any) {
    return this.disputes.resolve(user.sub, id, dto, meta);
  }

  // ------------------------------------------------------------------
  // Rapports opérationnels
  // ------------------------------------------------------------------
  @Get('reports/daily')
  dailyReport(@Query('days') days?: string) {
    return {
      days: this.reports.daily(Number(days) || 7),
      statusDistribution: this.reports.statusDistribution(),
      typeDistribution: this.reports.typeDistribution(),
    };
  }
}
