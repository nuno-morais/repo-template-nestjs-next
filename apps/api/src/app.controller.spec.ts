import { Test } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('health endpoint', () => {
  it('reports availability', async () => {
    const module = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();
    expect(module.get(AppController).health()).toEqual({ status: 'ok' });
    await module.close();
  });
});
