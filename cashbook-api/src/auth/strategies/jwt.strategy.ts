import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';

interface CachedUser {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  expiresAt: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private userCache = new Map<string, CachedUser>();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET!,
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const sub = String(payload.sub);
    const cached = this.userCache.get(sub);
    const now = Date.now();

    if (cached && cached.expiresAt > now) {
      return cached.user;
    }

    let user: any = null;
    let attempts = 0;

    while (attempts < 2) {
      try {
        user = await this.prisma.users.findUnique({
          where: {
            id: BigInt(sub),
          },
        });
        break;
      } catch (err) {
        attempts++;
        if (attempts >= 2) {
          // If we have a cached user even if slightly expired, return it rather than failing with 500
          if (cached) {
            console.warn(`Prisma user lookup failed; using fallback cache for user ${sub}`);
            return cached.user;
          }
          console.error(`Failed to fetch user ${sub} from DB:`, err instanceof Error ? err.message : err);
          throw new UnauthorizedException('Authentication service temporarily unavailable');
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const userData = {
      id: user.id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    };

    this.userCache.set(sub, {
      user: userData,
      expiresAt: now + this.CACHE_TTL_MS,
    });

    return userData;
  }
}
