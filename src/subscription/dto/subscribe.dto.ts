import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

export const PLANS = {
  free: { name: 'Free', price: 0, durationDays: 30, maxProjects: 3, maxMembers: 5 },
  pro: { name: 'Pro', price: 29, durationDays: 30, maxProjects: 50, maxMembers: 25 },
  enterprise: { name: 'Enterprise', price: 99, durationDays: 365, maxProjects: -1, maxMembers: -1 },
} as const;

export type PlanId = keyof typeof PLANS;

export class SubscribeDto {
  @ApiProperty({ enum: ['free', 'pro', 'enterprise'], example: 'pro' })
  @IsIn(['free', 'pro', 'enterprise'])
  plan!: PlanId;
}
