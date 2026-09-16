import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, JwtAuthGuard, RequestMeta, Roles, RolesGuard } from '../common/guards';
import { AccountsService } from '../accounts/accounts.service';
import { TransactionsService } from '../transactions/transactions.service';
import { DisputesService } from '../disputes/disputes.service';
import { CustomersService } from '../customers/customers.service';
import { customers, query } from '../database/connection';
import { IsBoolean, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, IsNumber } from 'class-validator';

export class InitiateTxDto {
  @IsIn(['DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'PAYMENT'], { message: 'Type de transaction invalide.' })
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER' | 'PAYMENT';

  @IsNumber({}, { message: 'Le montant doit être un nombre.' })
  @Min(1, { message: 'Le montant doit être supérieur à 0.' })
  @Max(100000000, { message: 'Montant trop élevé.' })
  amount: number;

  @IsOptional() @IsString() accountId?: string;
  @IsOptional() @IsString() targetAccountNumber?: string;
  @IsOptional() @IsString() beneficiaryName?: string;
  @IsOptional() @IsString() description?: string;
}

export class ConfirmTxDto {
  @IsBoolean({ message: 'La confirmation doit être un booléen.' })
  legitimate: boolean;
}

export class CreateDisputeDto {
  @IsString() @IsNotEmpty({ message: 'La transaction est requise.' })
  transactionId: string;

  @IsString() @IsNotEmpty({ message: 'Le motif est requis.' })
  reason: string;

  @IsOptional() @IsString() description?: string;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() firstName?: string;
  @IsOptional() @IsString() lastName?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() city?: string;
}

/**
 * Espace CLIENT — opérations bancaires personnelles.
 * Un client ne peut jamais accéder aux routes /employee/* ou /admin/*.
 */
@Controller('customer')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('CLIENT')
export class CustomerController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly transactions: TransactionsService,
    private readonly disputes: DisputesService,
    private readonly customersService: CustomersService,
  ) {}

  // ------------------------------------------------------------------
  // Tableau de bord
  // ------------------------------------------------------------------
  @Get('dashboard')
  dashboard(@CurrentUser() user: any) {
    const customer = customers.first('user_id = ?', [user.sub]);
    if (!customer) return { error: 'Profil client introuvable.' };
    const accountsList = this.accounts.getForCustomer(customer.id).map((a) => ({
      ...a,
      balance: Number(a.balance),
      dailyLimit: Number(a.dailyLimit),
      perTxLimit: Number(a.perTxLimit),
    }));
    const accountIds = accountsList.map((a) => a.id);
    const ph = accountIds.length ? accountIds.map(() => '?').join(',') : "''";
    const txWhere = `(source_account_id IN (${ph}) OR target_account_id IN (${ph}))`;
    const recent = accountIds.length
      ? query(
          `SELECT * FROM transactions WHERE ${txWhere} ORDER BY created_at DESC LIMIT 8`,
          [...accountIds, ...accountIds],
        ).map((t: any) => ({ ...t, amount: Number(t.amount) }))
      : [];
    const pendingCount = accountIds.length
      ? query(
          `SELECT COUNT(*) AS c FROM transactions WHERE ${txWhere} AND status IN ('PENDING','PROCESSING','UNDER_REVIEW')`,
          [...accountIds, ...accountIds],
        )[0].c
      : 0;
    const totals = accountIds.length
      ? query(
          `SELECT
             COALESCE(SUM(CASE WHEN type='DEPOSIT' THEN amount ELSE 0 END),0) AS deposits,
             COALESCE(SUM(CASE WHEN type='WITHDRAWAL' THEN amount ELSE 0 END),0) AS withdrawals,
             COALESCE(SUM(CASE WHEN type='TRANSFER' THEN amount ELSE 0 END),0) AS transfers
           FROM transactions
           WHERE (source_account_id IN (${ph}) OR target_account_id IN (${ph}))
             AND status = 'COMPLETED'
             AND created_at >= DATE('now','-30 days')`,
          [...accountIds, ...accountIds],
        )[0]
      : { deposits: 0, withdrawals: 0, transfers: 0 };

    const securityAlerts = query(
      `SELECT n.* FROM notifications n
       WHERE n.user_id = ? AND n.type IN ('FRAUD_ALERT','VERIFICATION_REQUEST','SECURITY_ALERT')
       ORDER BY n.created_at DESC LIMIT 5`,
      [user.sub],
    );

    return {
      accounts: accountsList,
      balance: accountsList.reduce((s, a) => s + a.balance, 0),
      recentTransactions: recent,
      pendingCount: Number(pendingCount),
      monthlyTotals: {
        deposits: Number(totals.deposits),
        withdrawals: Number(totals.withdrawals),
        transfers: Number(totals.transfers),
      },
      securityAlerts,
    };
  }

  // ------------------------------------------------------------------
  // Comptes
  // ------------------------------------------------------------------
  @Get('accounts')
  myAccounts(@CurrentUser() user: any) {
    const customer = customers.first('user_id = ?', [user.sub]);
    if (!customer) return [];
    return this.accounts.getForCustomer(customer.id).map((a) => ({
      ...a,
      balance: Number(a.balance),
      dailyLimit: Number(a.dailyLimit),
      perTxLimit: Number(a.perTxLimit),
    }));
  }

  // ------------------------------------------------------------------
  // Transactions
  // ------------------------------------------------------------------
  @Get('transactions')
  myTransactions(@CurrentUser() user: any, @Query() q: any) {
    return this.transactions.listForCustomer(user.sub, q);
  }

  @Get('transactions/:id')
  myTransaction(@CurrentUser() user: any, @Param('id') id: string) {
    return this.transactions.getDetail(id);
  }

  @Post('transactions')
  initiate(@CurrentUser() user: any, @Body() dto: InitiateTxDto, @RequestMeta() meta: any) {
    return this.transactions.initiate(dto, user, meta);
  }

  @Post('transactions/:id/confirm')
  confirm(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: ConfirmTxDto, @RequestMeta() meta: any) {
    return this.transactions.customerConfirm(user.sub, id, dto.legitimate, meta);
  }

  // ------------------------------------------------------------------
  // Litiges
  // ------------------------------------------------------------------
  @Get('disputes')
  myDisputes(@CurrentUser() user: any) {
    return this.disputes.listForCustomer(user.sub);
  }

  @Get('disputes/:id')
  myDispute(@CurrentUser() user: any, @Param('id') id: string) {
    return this.disputes.getDetail(id);
  }

  @Post('disputes')
  createDispute(@CurrentUser() user: any, @Body() dto: CreateDisputeDto, @RequestMeta() meta: any) {
    return this.disputes.submit(user.sub, dto, meta);
  }

  // ------------------------------------------------------------------
  // Profil
  // ------------------------------------------------------------------
  @Get('profile')
  profile(@CurrentUser() user: any) {
    const customer = customers.first('user_id = ?', [user.sub]);
    if (!customer) return null;
    return this.customersService.getDetail(customer.id);
  }

  @Patch('profile')
  updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.customersService.updateSelf(user.sub, dto);
  }
}
