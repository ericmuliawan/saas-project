import {
  Body,
  Controller,
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
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ProjectService } from './project.service';

@ApiTags('Projects')
@ApiBearerAuth('access-token')
@Controller('projects')
@RequireTenant()
@UseGuards(RolesGuard)
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Create a new project (admin/owner only)' })
  async create(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: CreateProjectDto,
  ) {
    const project = await this.projectService.create(
      req.user.companyId!,
      req.user.id,
      dto,
    );
    return successResponse(project);
  }

  @Get()
  @ApiOperation({ summary: 'List all projects in active company' })
  async findAll(
    @Req() req: { user: AuthenticatedUser },
    @Body() pagination: PaginationDto,
  ) {
    const { projects, total, page, limit } = await this.projectService.findAll(
      req.user.companyId!,
      pagination,
    );
    return listResponse(projects, { page, limit, total });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a project by ID' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  async findOne(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    const project = await this.projectService.findOne(req.user.companyId!, id);
    return successResponse(project);
  }

  @Patch(':id')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Update a project (admin/owner only)' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  async update(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    const project = await this.projectService.update(
      req.user.companyId!,
      id,
      dto,
    );
    return successResponse(project);
  }

  @Patch(':id/archive')
  @Roles('owner', 'admin')
  @ApiOperation({ summary: 'Archive a project (admin/owner only)' })
  @ApiParam({ name: 'id', description: 'Project UUID' })
  async archive(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    const project = await this.projectService.archive(req.user.companyId!, id);
    return successResponse(project);
  }
}
