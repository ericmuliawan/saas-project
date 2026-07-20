import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';

export class UpdateMemberRoleDto {
  @ApiProperty({
    enum: ['owner', 'admin', 'member'],
    description: 'New role for the member',
  })
  @IsNotEmpty()
  @IsEnum(['owner', 'admin', 'member'])
  role!: string;
}
