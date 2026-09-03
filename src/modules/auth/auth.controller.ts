import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SelectCompanyDto } from './dto/select-company.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Langkah 1/2: event key + nomor HP, TANPA OTP. Balikin identityToken +
  // daftar company yang bisa dipilih (satu exhibitor bisa pegang > 1 company).
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  // Langkah 2/2: tukar identityToken + companyId pilihan -> access/refresh
  // token penuh.
  @Post('select-company')
  @HttpCode(HttpStatus.OK)
  selectCompany(@Body() dto: SelectCompanyDto) {
    return this.authService.selectCompany(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refresh(refreshToken);
  }
}
