import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { users, customers, accounts } from '../database/connection';
import { nowIso, uuid, accountNumber } from '../common/utils';
import { AuditService } from '../audit/audit.service';
import { RegisterDto, LoginDto, ChangePasswordDto, ForgotPasswordDto, ResetPasswordDto } from './dto';

export function sanitizeUser(u: any) {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    role: u.role,
    isActive: !!u.isActive,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  };
}

@Injectable()
export class AuthService {
  /** Codes de réinitialisation en mémoire (prototype) : email -> {code, expiresAt} */
  private resetCodes = new Map<string, { code: string; expiresAt: number }>();

  constructor(
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async register(dto: RegisterDto, meta: { ip?: string; userAgent?: string }) {
    const existing = users.first('email = ?', [dto.email.toLowerCase()]);
    if (existing) throw new ConflictException('Un compte existe déjà avec cette adresse e-mail.');

    const hashed = await bcrypt.hash(dto.password, 10);
    const now = nowIso();
    const user = users.insert({
      id: uuid(),
      email: dto.email.toLowerCase(),
      password: hashed,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      phone: dto.phone ?? null,
      role: 'CLIENT',
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    // Création automatique du profil client et de son premier compte bancaire.
    const customer = customers.insert({
      id: uuid(),
      userId: user.id,
      address: null,
      city: null,
      country: 'Cameroun',
      isActive: true,
      createdAt: now,
    });
    const seq = accounts.count() + 10000101;
    const account = accounts.insert({
      id: uuid(),
      accountNumber: accountNumber(seq),
      customerId: customer.id,
      balance: 0,
      status: 'ACTIVE',
      dailyLimit: 5000000,
      perTxLimit: 2000000,
      openedAt: now,
    });

    this.audit.record({
      userId: user.id,
      action: 'REGISTER',
      entity: 'USER',
      entityId: user.id,
      description: `Création du compte client ${user.email}`,
      ...meta,
    });

    return this.issueToken(user, { accountNumber: account.accountNumber });
  }

  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string }) {
    const user = users.first('email = ?', [dto.email.toLowerCase()]);
    if (!user) throw new UnauthorizedException('E-mail ou mot de passe incorrect.');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('E-mail ou mot de passe incorrect.');
    if (!user.isActive) {
      throw new UnauthorizedException('Votre compte a été désactivé. Contactez votre banque.');
    }
    if (user.role === 'CLIENT') {
      const customer = customers.first('user_id = ?', [user.id]);
      if (customer && !customer.isActive) {
        throw new UnauthorizedException('Votre compte a été désactivé. Contactez votre banque.');
      }
    }

    users.update(user.id, { lastLoginAt: nowIso(), updatedAt: nowIso() });
    this.audit.record({
      userId: user.id,
      action: 'LOGIN',
      entity: 'USER',
      entityId: user.id,
      description: `Connexion de ${user.email}`,
      ...meta,
    });

    return this.issueToken({ ...user, lastLoginAt: nowIso() });
  }

  logout(userId: string, meta: { ip?: string; userAgent?: string }) {
    this.audit.record({
      userId,
      action: 'LOGOUT',
      entity: 'USER',
      entityId: userId,
      description: 'Déconnexion',
      ...meta,
    });
    return { success: true };
  }

  me(userId: string) {
    const user = users.byId(userId);
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    return sanitizeUser(user);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = users.byId(userId);
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    const valid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!valid) throw new BadRequestException('Le mot de passe actuel est incorrect.');
    const hashed = await bcrypt.hash(dto.newPassword, 10);
    users.update(userId, { password: hashed, updatedAt: nowIso() });
    this.audit.record({
      userId,
      action: 'PASSWORD_CHANGED',
      entity: 'USER',
      entityId: userId,
      description: 'Modification du mot de passe',
    });
    return { success: true };
  }

  forgotPassword(dto: ForgotPasswordDto) {
    const user = users.first('email = ?', [dto.email.toLowerCase()]);
    // Réponse identique que l'e-mail existe ou non (sécurité).
    if (!user) return { success: true, demoCode: null };
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.resetCodes.set(user.email, { code, expiresAt: Date.now() + 15 * 60 * 1000 });
    // En production : envoi par e-mail. Ici le code est renvoyé pour la démonstration.
    return { success: true, demoCode: code };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const entry = this.resetCodes.get(dto.email.toLowerCase());
    if (!entry || entry.expiresAt < Date.now() || entry.code !== dto.code) {
      throw new BadRequestException('Code de réinitialisation invalide ou expiré.');
    }
    const user = users.first('email = ?', [dto.email.toLowerCase()]);
    if (!user) throw new NotFoundException('Utilisateur introuvable.');
    const hashed = await bcrypt.hash(dto.newPassword, 10);
    users.update(user.id, { password: hashed, updatedAt: nowIso() });
    this.resetCodes.delete(dto.email.toLowerCase());
    this.audit.record({
      userId: user.id,
      action: 'PASSWORD_RESET',
      entity: 'USER',
      entityId: user.id,
      description: 'Réinitialisation du mot de passe',
    });
    return { success: true };
  }

  private issueToken(user: any, extra?: Record<string, any>) {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName,
    };
    return {
      accessToken: this.jwt.sign(payload),
      user: sanitizeUser(user),
      ...extra,
    };
  }
}
