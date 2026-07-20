import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TaskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async create(
    companyId: string,
    projectId: string,
    userId: string,
    dto: CreateTaskDto,
  ) {
    await this.verifyProjectExists(companyId, projectId);

    const task = await this.prisma.withTenant(companyId, (tx) =>
      tx.task.create({
        data: {
          companyId,
          projectId,
          title: dto.title,
          description: dto.description,
          priority: dto.priority ?? 'medium',
          assigneeId: dto.assigneeId,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          assigneeId: true,
          dueDate: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );

    if (dto.assigneeId) {
      await this.notificationService.addTaskAssignedNotification({
        taskId: task.id,
        taskTitle: task.title,
        assigneeId: dto.assigneeId,
        companyId,
      });
    }

    return task;
  }

  async findAll(
    companyId: string,
    projectId: string,
    pagination: PaginationDto,
  ) {
    await this.verifyProjectExists(companyId, projectId);

    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [tasks, total] = await this.prisma.withTenant(companyId, (tx) =>
      Promise.all([
        tx.task.findMany({
          where: { companyId, projectId },
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            assigneeId: true,
            dueDate: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        tx.task.count({ where: { companyId, projectId } }),
      ]),
    );

    return { tasks, total, page, limit };
  }

  async findOne(companyId: string, projectId: string, taskId: string) {
    const task = await this.prisma.withTenant(companyId, (tx) =>
      tx.task.findFirst({
        where: { id: taskId, projectId, companyId },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          assigneeId: true,
          dueDate: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return task;
  }

  async update(
    companyId: string,
    projectId: string,
    taskId: string,
    userId: string,
    userRole: string,
    dto: UpdateTaskDto,
  ) {
    const existing = await this.findOne(companyId, projectId, taskId);

    if (userRole === 'member' && existing.assigneeId !== userId) {
      throw new ForbiddenException(
        'Members can only update tasks assigned to them',
      );
    }

    const previousAssigneeId = existing.assigneeId;

    const task = await this.prisma.withTenant(companyId, (tx) =>
      tx.task.update({
        where: { id: taskId, companyId, projectId },
        data: {
          ...(dto.title !== undefined && { title: dto.title }),
          ...(dto.description !== undefined && {
            description: dto.description,
          }),
          ...(dto.status !== undefined && { status: dto.status }),
          ...(dto.priority !== undefined && { priority: dto.priority }),
          ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId }),
          ...(dto.dueDate !== undefined && {
            dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          }),
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          assigneeId: true,
          dueDate: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    );

    if (dto.assigneeId && dto.assigneeId !== previousAssigneeId) {
      await this.notificationService.addTaskAssignedNotification({
        taskId: task.id,
        taskTitle: task.title,
        assigneeId: dto.assigneeId,
        companyId,
      });
    }

    return task;
  }

  async remove(companyId: string, projectId: string, taskId: string) {
    await this.findOne(companyId, projectId, taskId);

    await this.prisma.withTenant(companyId, (tx) =>
      tx.task.delete({
        where: { id: taskId, companyId, projectId },
      }),
    );
  }

  private async verifyProjectExists(companyId: string, projectId: string) {
    const project = await this.prisma.withTenant(companyId, (tx) =>
      tx.project.findUnique({
        where: { id_companyId: { id: projectId, companyId } },
        select: { id: true },
      }),
    );

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }
}
