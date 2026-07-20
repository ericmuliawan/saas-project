import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'Alice Johnson', description: 'Full name' })
  @IsString()
  @MinLength(2)
  @MaxLength(150)
  fullName!: string;

  @ApiProperty({ example: 'alice@example.com', description: 'Email address' })
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @ApiProperty({
    example: 'Password123',
    description: 'Password (min 12 chars, uppercase + lowercase + number)',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(72)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'password must contain uppercase, lowercase, and a number',
  })
  password!: string;
}
