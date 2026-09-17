import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  createParamDecorator,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

/** Garde d'authentification JWT. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Garde RBAC : vérifie le rôle de l'utilisateur authentifié.
 * Combiné aux préfixes de routes (/customer, /employee, /admin),
 * un CLIENT ne peut jamais accéder aux fonctionnalités employé/admin.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;
    const { user } = context.switchToHttp().getRequest();
    if (!user) throw new ForbiddenException('Accès refusé.');
    if (!required.includes(user.role)) {
      throw new ForbiddenException(
        "Accès refusé : votre rôle ne permet pas d'accéder à cette ressource.",
      );
    }
    return true;
  }
}

/** Utilisateur courant extrait du JWT. */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest().user;
});

/** Métadonnées de requête (IP, user-agent) pour l'audit. */
export const RequestMeta = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const req = ctx.switchToHttp().getRequest();
  return {
    ip: req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress,
    userAgent: req.headers?.['user-agent'],
  };
});
