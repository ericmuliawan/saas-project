import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlanId, PLANS } from './dto/subscribe.dto';

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  getPlans() {
    return Object.entries(PLANS).map(([id, plan]) => ({
      id,
      ...plan,
    }));
  }

  async subscribe(userId: string, planId: PlanId) {
    const plan = PLANS[planId];
    if (!plan) {
      throw new BadRequestException('Invalid plan');
    }

    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true, subscriptionEndsAt: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.subscriptionStatus === 'active' && user.subscriptionEndsAt && user.subscriptionEndsAt > new Date()) {
      throw new BadRequestException('You already have an active subscription');
    }

    const now = new Date();
    const endsAt = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    const updated = await this.prisma.appUser.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'active',
        subscriptionEndsAt: endsAt,
      },
      select: {
        id: true,
        email: true,
        subscriptionStatus: true,
        subscriptionEndsAt: true,
      },
    });

    return {
      message: `Subscribed to ${plan.name} plan successfully`,
      plan: {
        id: planId,
        name: plan.name,
        price: plan.price,
        durationDays: plan.durationDays,
      },
      subscription: {
        status: updated.subscriptionStatus,
        endsAt: updated.subscriptionEndsAt,
      },
    };
  }

  async getStatus(userId: string) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: {
        subscriptionStatus: true,
        subscriptionEndsAt: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const isActive = user.subscriptionStatus === 'active' && user.subscriptionEndsAt && user.subscriptionEndsAt > new Date();

    return {
      status: user.subscriptionStatus,
      endsAt: user.subscriptionEndsAt,
      isActive,
      daysRemaining: isActive && user.subscriptionEndsAt
        ? Math.max(0, Math.ceil((user.subscriptionEndsAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : 0,
    };
  }

  async cancel(userId: string) {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      select: { subscriptionStatus: true },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.subscriptionStatus !== 'active') {
      throw new BadRequestException('No active subscription to cancel');
    }

    await this.prisma.appUser.update({
      where: { id: userId },
      data: { subscriptionStatus: 'cancelled' },
    });

    return { message: 'Subscription cancelled. Access continues until end of billing period.' };
  }
}
