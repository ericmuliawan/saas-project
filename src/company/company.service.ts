import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@Injectable()
export class CompanyService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateCompanyDto) {
    try {
      const company = await this.prisma.company.create({
        data: {
          name: dto.name,
          slug: dto.slug,
          ownerId: userId,
        },
        select: {
          id: true,
          name: true,
          slug: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return company;
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Company slug already exists');
      }
      throw error;
    }
  }

  async findAllByUser(userId: string) {
    const memberships = await this.prisma.companyMember.findMany({
      where: { userId },
      select: {
        role: true,
        joinedAt: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            ownerId: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return memberships.map((m) => ({
      ...m.company,
      myRole: m.role,
      joinedAt: m.joinedAt,
    }));
  }

  async findOne(companyId: string, userId: string) {
    const membership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });

    if (!membership) {
      throw new NotFoundException('Company not found');
    }

    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        slug: true,
        ownerId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async update(companyId: string, userId: string, dto: UpdateCompanyDto) {
    const membership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: { role: true },
    });

    if (!membership) {
      throw new NotFoundException('Company not found');
    }

    if (membership.role !== 'owner') {
      throw new ForbiddenException('Only the company owner can update it');
    }

    try {
      return await this.prisma.company.update({
        where: { id: companyId },
        data: { ...dto },
        select: {
          id: true,
          name: true,
          slug: true,
          ownerId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Company slug already exists');
      }
      throw error;
    }
  }

  async remove(companyId: string, userId: string) {
    const membership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
      select: { role: true },
    });

    if (!membership) {
      throw new NotFoundException('Company not found');
    }

    if (membership.role !== 'owner') {
      throw new ForbiddenException('Only the company owner can delete it');
    }

    await this.prisma.company.delete({ where: { id: companyId } });

    return { message: 'Company deleted successfully' };
  }

  async switchActive(userId: string, companyId: string) {
    const membership = await this.prisma.companyMember.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });

    if (!membership) {
      throw new ForbiddenException('You are not a member of this company');
    }

    await this.prisma.appUser.update({
      where: { id: userId },
      data: { activeCompanyId: companyId },
    });

    return { message: 'Active company switched', companyId };
  }
}
