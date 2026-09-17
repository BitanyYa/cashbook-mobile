import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    const existingUser = await this.prisma.users.findUnique({
      where: {
        email,
      },
    });

    if (existingUser) {
      throw new ConflictException(
        'An account with this email already exists',
      );
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.users.create({
      data: {
        name: dto.name.trim(),
        email,
        password: hashedPassword,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return {
      message: 'Account created successfully',
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();

    const user = await this.prisma.users.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException(
        'Invalid email or password',
      );
    }

    const payload = {
      sub: user.id.toString(),
      email: user.email,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      message: 'Login successful',
      accessToken,
      user: {
        id: user.id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}