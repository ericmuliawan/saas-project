import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, userId: string, dto: CreateProjectDto) {
    return this.prisma.withTenant(companyId, (tx) =>
      tx.project.create({
        data: {
          companyId,
          name: dto.name,
          description: dto.description,
          createdById: userId,
        },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );
  }

  async findAll(companyId: string, pagination: PaginationDto) {
    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [projects, total] = await this.prisma.withTenant(companyId, (tx) =>
      Promise.all([
        tx.project.findMany({
          where: { companyId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        tx.project.count({ where: { companyId } }),
      ]),
    );

    return { projects, total, page, limit };
  }

  async findOne(companyId: string, projectId: string) {
    const project = await this.prisma.withTenant(companyId, (tx) =>
      tx.project.findUnique({
        where: { id_companyId: { id: projectId, companyId } },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  async update(companyId: string, projectId: string, dto: UpdateProjectDto) {
    await this.findOne(companyId, projectId);

    return this.prisma.withTenant(companyId, (tx) =>
      tx.project.update({
        where: { id_companyId: { id: projectId, companyId } },
        data: { ...dto },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );
  }

  async archive(companyId: string, projectId: string) {
    await this.findOne(companyId, projectId);

    return this.prisma.withTenant(companyId, (tx) =>
      tx.project.update({
        where: { id_companyId: { id: projectId, companyId } },
        data: { status: 'archived' },
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );
  }
}
