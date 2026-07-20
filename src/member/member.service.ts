import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';

@Injectable()
export class MemberService {
  constructor(private readonly prisma: PrismaService) {}

  async addMember(companyId: string, dto: AddMemberDto) {
    const user = await this.prisma.appUser.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
      select: { id: true, fullName: true, email: true },
    });

    if (!user) {
      throw new NotFoundException('User with this email is not registered yet');
    }

    const existingMembership = await this.prisma.withTenant(companyId, (tx) =>
      tx.companyMember.findUnique({
        where: { companyId_userId: { companyId, userId: user.id } },
      }),
    );

    if (existingMembership) {
      throw new ConflictException('User is already a member of this company');
    }

    const membership = await this.prisma.withTenant(companyId, (tx) =>
      tx.companyMember.create({
        data: {
          companyId,
          userId: user.id,
          role: dto.role,
        },
        select: {
          companyId: true,
          userId: true,
          role: true,
          joinedAt: true,
          user: {
            select: { id: true, email: true, fullName: true },
          },
        },
      }),
    );

    return membership;
  }

  async findAll(companyId: string) {
    const members = await this.prisma.withTenant(companyId, (tx) =>
      tx.companyMember.findMany({
        where: { companyId },
        orderBy: { joinedAt: 'asc' },
        select: {
          companyId: true,
          userId: true,
          role: true,
          joinedAt: true,
          user: {
            select: { id: true, email: true, fullName: true },
          },
        },
      }),
    );

    return members;
  }

  async updateRole(
    companyId: string,
    userId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const membership = await this.prisma.withTenant(companyId, (tx) =>
      tx.companyMember.findUnique({
        where: { companyId_userId: { companyId, userId } },
      }),
    );

    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    const updated = await this.prisma.withTenant(companyId, (tx) =>
      tx.companyMember.update({
        where: { companyId_userId: { companyId, userId } },
        data: { role: dto.role },
        select: {
          companyId: true,
          userId: true,
          role: true,
          joinedAt: true,
          user: {
            select: { id: true, email: true, fullName: true },
          },
        },
      }),
    );

    return updated;
  }

  async removeMember(companyId: string, userId: string, requesterId: string) {
    if (userId === requesterId) {
      throw new ForbiddenException(
        'You cannot remove yourself from the company',
      );
    }

    const membership = await this.prisma.withTenant(companyId, (tx) =>
      tx.companyMember.findUnique({
        where: { companyId_userId: { companyId, userId } },
        select: { role: true },
      }),
    );

    if (!membership) {
      throw new NotFoundException('Member not found');
    }

    if (membership.role === 'owner') {
      throw new ForbiddenException('Cannot remove the company owner');
    }

    await this.prisma.withTenant(companyId, (tx) =>
      tx.companyMember.delete({
        where: { companyId_userId: { companyId, userId } },
      }),
    );

    return { message: 'Member removed successfully' };
  }
}
