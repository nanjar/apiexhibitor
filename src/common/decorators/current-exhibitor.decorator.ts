import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentExhibitor {
  exhibitorId: number;
  eventsId: number;
  companyId: number;
  fullname: string;
  phone: string;
  isOwner: boolean;
  canScan: boolean;
  canChat: boolean;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentExhibitor => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
