import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from '../auth.service';
import { CurrentExhibitor } from '../../../common/decorators/current-exhibitor.decorator';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_ACCESS_SECRET'),
    });
  }

  validate(payload: JwtPayload | { stage?: string }): CurrentExhibitor {
    // FIX KEAMANAN (Sept 2026): identityToken (hasil /auth/login, sebelum
    // pilih booth) pakai secret YANG SAMA dengan accessToken, tapi field
    // companyId/venueId/spaceId/dst tidak ada di payload-nya. Tanpa
    // pengecekan ini, identityToken bisa dipakai langsung ke endpoint mana
    // pun (approve meeting, invite member, dst) padahal harusnya cuma
    // valid untuk /auth/select-company-booth.
    if ('stage' in payload && payload.stage) {
      throw new UnauthorizedException(
        'Token ini belum lengkap (identity token) - selesaikan /auth/select-company-booth dulu',
      );
    }
    const full = payload as JwtPayload;
    if (
      full.companyId === undefined ||
      full.venueId === undefined ||
      full.spaceId === undefined
    ) {
      throw new UnauthorizedException('Token tidak valid untuk akses ini');
    }

    return {
      exhibitorId: full.sub,
      eventsId: full.eventsId,
      companyId: full.companyId,
      venueId: full.venueId,
      spaceId: full.spaceId,
      fullname: full.fullname,
      phone: full.phone,
      isOwner: full.isOwner,
      canScan: full.canScan,
      canChat: full.canChat,
    };
  }
}
