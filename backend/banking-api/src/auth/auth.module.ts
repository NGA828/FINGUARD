import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import '../env';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../env';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: JWT_SECRET,
        signOptions: { expiresIn: JWT_EXPIRES_IN },
      }),
    }),
    AuditModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
