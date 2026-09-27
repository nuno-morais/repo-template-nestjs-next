import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator';
@Controller('health')
export class AppController {
  @Get() @Public() health(): { status: 'ok' } {
    return { status: 'ok' };
  }
}
