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
import { PaginationDto } from '../common/dto/pagination.dto';
import {
  listResponse,
  successResponse,
} from '../common/helpers/response.helper';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskService } from './task.service';

@ApiTags('Tasks')
@ApiBearerAuth('access-token')
@Controller('projects/:projectId/tasks')
@RequireTenant()
@UseGuards(RolesGuard)
export class TaskController {
  constructor(private readonly taskService: TaskService) {}

  @Post()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create a task in a project (admin/owner only)' })
  @ApiParam({ name: 'projectId', description: 'Parent project UUID' })
  async create(
    @Req() req: { user: AuthenticatedUser },
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    const task = await this.taskService.create(
      req.user.companyId!,
      projectId,
      req.user.id,
      dto,
    );
    return successResponse(task);
  }

  @Get()
  @ApiOperation({ summary: 'List all tasks in a project' })
  @ApiParam({ name: 'projectId', description: 'Parent project UUID' })
  async findAll(
    @Req() req: { user: AuthenticatedUser },
    @Param('projectId') projectId: string,
    @Body() pagination: PaginationDto,
  ) {
    const { tasks, total, page, limit } = await this.taskService.findAll(
      req.user.companyId!,
      projectId,
      pagination,
    );
    return listResponse(tasks, { page, limit, total });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a task by ID' })
  @ApiParam({ name: 'projectId', description: 'Parent project UUID' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  async findOne(
    @Req() req: { user: AuthenticatedUser },
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    const task = await this.taskService.findOne(
      req.user.companyId!,
      projectId,
      id,
    );
    return successResponse(task);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a task (admin/owner or assigned member)' })
  @ApiParam({ name: 'projectId', description: 'Parent project UUID' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  async update(
    @Req() req: { user: AuthenticatedUser },
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateTaskDto,
  ) {
    const task = await this.taskService.update(
      req.user.companyId!,
      projectId,
      id,
      req.user.id,
      req.user.role!,
      dto,
    );
    return successResponse(task);
  }

  @Delete(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Delete a task (admin/owner only)' })
  @ApiParam({ name: 'projectId', description: 'Parent project UUID' })
  @ApiParam({ name: 'id', description: 'Task UUID' })
  async remove(
    @Req() req: { user: AuthenticatedUser },
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    await this.taskService.remove(req.user.companyId!, projectId, id);
    return successResponse({ message: 'Task deleted successfully' });
  }
}
