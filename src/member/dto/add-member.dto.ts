import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({
    example: 'bob@example.com',
    description: 'Email of the user to add',
  })
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @ApiProperty({
    enum: ['admin', 'member'],
    example: 'member',
    description: 'Role for the new member',
  })
  @IsNotEmpty()
  @IsEnum(['admin', 'member'])
  role!: string;
}
