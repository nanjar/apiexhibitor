import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { CurrentExhibitor } from '../decorators/current-exhibitor.decorator';

/**
 * Dipakai SETELAH AuthGuard('jwt') - cek req.user.isOwner. Aksi yang butuh
 * ini: invite/remove/restore/ubah-permission anggota booth. Staff biasa
 * (OPR) cuma bisa lihat daftar anggota, tidak bisa ubah.
 */
@Injectable()
export class OwnerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: CurrentExhibitor = request.user;
    if (!user?.isOwner) {
      throw new ForbiddenException('Hanya pemilik booth yang bisa melakukan aksi ini');
    }
    return true;
  }
}
