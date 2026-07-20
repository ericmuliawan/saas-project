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
import { RequireTenant } from '../auth/decorators/require-tenant.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { successResponse } from '../common/helpers/response.helper';
import { CompanyService } from './company.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { SwitchCompanyDto } from './dto/switch-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

@ApiTags('Companies')
@ApiBearerAuth('access-token')
@Controller('companies')
@UseGuards(RolesGuard)
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new company' })
  async create(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: CreateCompanyDto,
  ) {
    const company = await this.companyService.create(req.user.id, dto);
    return successResponse(company);
  }

  @Get()
  @RequireTenant()
  @ApiOperation({ summary: 'List all companies you belong to' })
  async findAll(@Req() req: { user: AuthenticatedUser }) {
    const companies = await this.companyService.findAllByUser(req.user.id);
    return successResponse(companies);
  }

  @Get(':id')
  @RequireTenant()
  @ApiOperation({ summary: 'Get company details' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  async findOne(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    const company = await this.companyService.findOne(id, req.user.id);
    return successResponse(company);
  }

  @Patch(':id')
  @RequireTenant()
  @Roles('owner')
  @ApiOperation({ summary: 'Update company (owner only)' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  async update(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    const company = await this.companyService.update(id, req.user.id, dto);
    return successResponse(company);
  }

  @Delete(':id')
  @RequireTenant()
  @Roles('owner')
  @ApiOperation({ summary: 'Delete company (owner only)' })
  @ApiParam({ name: 'id', description: 'Company UUID' })
  async remove(
    @Req() req: { user: AuthenticatedUser },
    @Param('id') id: string,
  ) {
    const result = await this.companyService.remove(id, req.user.id);
    return successResponse(result);
  }

  @Post('switch')
  @ApiOperation({ summary: 'Switch active company' })
  async switchActive(
    @Req() req: { user: AuthenticatedUser },
    @Body() dto: SwitchCompanyDto,
  ) {
    const result = await this.companyService.switchActive(
      req.user.id,
      dto.companyId,
    );
    return successResponse(result);
  }
}
