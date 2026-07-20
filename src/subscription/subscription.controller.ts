import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { successResponse } from '../common/helpers/response.helper';
import { SubscribeDto } from './dto/subscribe.dto';
import { SubscriptionService } from './subscription.service';

@ApiTags('Subscriptions')
@ApiBearerAuth('access-token')
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List available subscription plans' })
  async getPlans() {
    const plans = this.subscriptionService.getPlans();
    return successResponse(plans);
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe to a plan' })
  async subscribe(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: SubscribeDto,
  ) {
    const result = await this.subscriptionService.subscribe(req.user.id, dto.plan);
    return successResponse(result);
  }

  @Get('status')
  @ApiOperation({ summary: 'Check subscription status' })
  async getStatus(@Req() req: { user: AuthenticatedUser }) {
    const status = await this.subscriptionService.getStatus(req.user.id);
    return successResponse(status);
  }

  @Post('cancel')
  @ApiOperation({ summary: 'Cancel subscription' })
  async cancel(@Req() req: { user: AuthenticatedUser }) {
    const result = await this.subscriptionService.cancel(req.user.id);
    return successResponse(result);
  }
}
