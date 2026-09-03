import { Injectable } from '@nestjs/common';
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

  validate(payload: JwtPayload): CurrentExhibitor {
    return {
      exhibitorId: payload.sub,
      eventsId: payload.eventsId,
      companyId: payload.companyId,
      fullname: payload.fullname,
      phone: payload.phone,
      isOwner: payload.isOwner,
      canScan: payload.canScan,
      canChat: payload.canChat,
    };
  }
}
