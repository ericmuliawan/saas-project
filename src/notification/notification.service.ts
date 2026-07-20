import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

export interface TaskAssignedPayload {
  taskId: string;
  taskTitle: string;
  assigneeId: string;
  companyId: string;
}

const QUEUE_NAME = 'notifications';

@Injectable()
export class NotificationService implements OnModuleDestroy {
  private readonly logger = new Logger(NotificationService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private initialized = false;

  constructor(private readonly prisma: PrismaService) {}

  private get redisConfig() {
    return {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    };
  }

  private async ensureConnected() {
    if (this.initialized) return;

    try {
      this.queue = new Queue(QUEUE_NAME, { connection: this.redisConfig });
      await this.queue.waitUntilReady();

      this.worker = new Worker(
        QUEUE_NAME,
        async (job: Job<TaskAssignedPayload>) => {
          await this.handleTaskAssigned(job);
        },
        { connection: this.redisConfig },
      );

      this.worker.on('failed', (job, err) => {
        this.logger.error(`Job ${job?.id} failed: ${err.message}`);
      });

      this.initialized = true;
      this.logger.log('Notification queue connected');
    } catch {
      this.queue = null;
      this.worker = null;
      this.initialized = false;
      this.logger.warn(
        'Redis unavailable — notification queue disabled. Start Redis to enable background jobs.',
      );
    }
  }

  async addTaskAssignedNotification(payload: TaskAssignedPayload) {
    await this.ensureConnected();

    if (!this.queue) {
      this.logger.warn(
        `Skipping notification — Redis unavailable. Task: ${payload.taskTitle}`,
      );
      return;
    }

    await this.queue.add('task.assigned', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    });
  }

  private async handleTaskAssigned(job: Job<TaskAssignedPayload>) {
    const { taskId, taskTitle, assigneeId, companyId } = job.data;

    const assignee = await this.prisma.withTenant(companyId, (tx) =>
      tx.appUser.findUnique({
        where: { id: assigneeId },
        select: { email: true, fullName: true },
      }),
    );

    this.logger.log(
      `[Email Mock] To: ${assignee?.email ?? assigneeId} — ` +
        `You have been assigned to task "${taskTitle}" (ID: ${taskId})`,
    );

    return { success: true, email: assignee?.email };
  }

  async onModuleDestroy() {
    if (this.worker) await this.worker.close();
    if (this.queue) await this.queue.close();
  }
}
