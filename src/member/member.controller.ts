import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { RequireTenant } from '../auth/decorators/require-tenant.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { successResponse } from '../common/helpers/response.helper';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { MemberService } from './member.service';

@ApiTags('Members')
@ApiBearerAuth('access-token')
@Controller('members')
@RequireTenant()
@UseGuards(RolesGuard)
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Post()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Add a member to the company (admin/owner only)' })
  async addMember(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: AddMemberDto,
  ) {
    const member = await this.memberService.addMember(req.user.companyId!, dto);
    return successResponse(member);
  }

  @Get()
  @ApiOperation({ summary: 'List all members in the company' })
  async findAll(@Req() req: { user: AuthenticatedUser }) {
    const members = await this.memberService.findAll(req.user.companyId!);
    return successResponse(members);
  }

  @Patch(':userId/role')
  @Roles('owner')
  @ApiOperation({ summary: 'Update member role (owner only)' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  async updateRole(
    @Req() req: { user: AuthenticatedUser },
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    const member = await this.memberService.updateRole(
      req.user.companyId!,
      userId,
      dto,
    );
    return successResponse(member);
  }

  @Delete(':userId')
  @Roles('owner', 'admin')
  @ApiOperation({
    summary: 'Remove a member from the company (admin/owner only)',
  })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  async removeMember(
    @Req() req: { user: AuthenticatedUser },
    @Param('userId') userId: string,
  ) {
    const result = await this.memberService.removeMember(
      req.user.companyId!,
      userId,
      req.user.id,
    );
    return successResponse(result);
  }
}
