import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class SwitchCompanyDto {
  @ApiProperty({ description: 'Company ID to switch to' })
  @IsUUID()
  companyId: string;
}
