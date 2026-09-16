import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { GlobalProviders } from './common/filters';

import { AuthController } from './auth/auth.controller';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { CustomerController } from './customer/customer.controller';
import { EmployeeController } from './employee/employee.controller';
import { AdminController } from './administration/admin.controller';

import { AccountsService } from './accounts/accounts.service';
import { TransactionsService } from './transactions/transactions.service';
import { ExternalBankService } from './transactions/external-bank.service';
import { FraudService } from './fraud/fraud.service';
import { AlertsService } from './alerts/alerts.service';
import { DisputesService } from './disputes/disputes.service';
import { CustomersService } from './customers/customers.service';
import { EmployeesService } from './employees/employees.service';
import { ReportsService } from './reports/reports.service';
import { AdministrationService } from './administration/administration.service';
import { BeneficiariesService } from './beneficiaries/beneficiaries.service';
import { AuditService } from './audit/audit.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AuthModule, AuditModule],
  controllers: [NotificationsController, CustomerController, EmployeeController, AdminController],
  providers: [
    ...GlobalProviders,
    AuditService,
    NotificationsService,
    AccountsService,
    TransactionsService,
    ExternalBankService,
    FraudService,
    AlertsService,
    DisputesService,
    CustomersService,
    EmployeesService,
    ReportsService,
    AdministrationService,
    BeneficiariesService,
  ],
})
export class AppModule {}
