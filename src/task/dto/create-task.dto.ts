import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateTaskDto {
  @ApiProperty({ example: 'Design mockups', description: 'Task title' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(300)
  title!: string;

  @ApiPropertyOptional({ example: 'Create Figma mockups for the landing page' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['low', 'medium', 'high'], default: 'medium' })
  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: string;

  @ApiPropertyOptional({ description: 'UUID of the assignee (company member)' })
  @IsOptional()
  @IsUUID()
  assigneeId?: string;

  @ApiPropertyOptional({
    example: '2026-08-15',
    description: 'Due date (ISO 8601)',
  })
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
