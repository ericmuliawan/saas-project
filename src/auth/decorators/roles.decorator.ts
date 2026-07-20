import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export type CompanyRole = 'owner' | 'admin' | 'member';
export const Roles = (...roles: CompanyRole[]) => SetMetadata(ROLES_KEY, roles);
