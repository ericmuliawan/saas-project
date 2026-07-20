import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REQUIRE_TENANT_KEY } from '../decorators/require-tenant.decorator';
import { AuthenticatedUser } from '../types/authenticated-user.type';

interface JwtPayload {
  sub: string;
  email: string;
}

type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request);
    const payload = await this.verifyToken(token);
    const user = await this.prisma.appUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, activeCompanyId: true },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid access token');
    }

    const activeCompanyId = user.activeCompanyId;
    let role: AuthenticatedUser['role'] = null;
    if (activeCompanyId) {
      const membership = await this.prisma.withTenant(activeCompanyId, (tx) =>
        tx.companyMember.findUnique({
          where: {
            companyId_userId: {
              companyId: activeCompanyId,
              userId: user.id,
            },
          },
          select: { role: true },
        }),
      );

      if (!membership) {
        throw new UnauthorizedException('Invalid active company');
      }
      role = membership.role as AuthenticatedUser['role'];
    }

    if (
      this.reflector.getAllAndOverride<boolean>(REQUIRE_TENANT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) &&
      !user.activeCompanyId
    ) {
      throw new ForbiddenException('Select or create a company first');
    }

    request.user = {
      id: user.id,
      email: user.email,
      companyId: user.activeCompanyId,
      role,
    };
    return true;
  }

  private extractBearerToken(request: Request): string {
    const [scheme, token] = request.headers.authorization?.split(' ') ?? [];
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedException('Bearer token is required');
    }
    return token;
  }

  private async verifyToken(token: string): Promise<JwtPayload> {
    try {
      return await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.getJwtSecret(),
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }
  }

  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_SECRET must be set and contain at least 32 characters',
      );
    }
    return secret;
  }
}
