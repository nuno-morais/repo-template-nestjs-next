import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { defaultTokenMinter } from './fixtures/token-minter';

const a = defaultTokenMinter.mintOrgToken('user_a', 'org_a');
const b = defaultTokenMinter.mintOrgToken('user_b', 'org_b');
const personal = defaultTokenMinter.mintUserToken('user_a');

describe('Widgets API with PostgreSQL', () => {
  let app: INestApplication;
  beforeAll(async () => {
    process.env.CLERK_JWT_KEY = defaultTokenMinter.publicKey;
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    if (app) await app.close();
  });

  it('publishes public health and requires signed JWT for widgets', async () => {
    await request(app.getHttpServer())
      .get('/v1/health')
      .expect(200, { status: 'ok' });
    await request(app.getHttpServer()).get('/v1/widgets').expect(401);
    await request(app.getHttpServer())
      .get('/v1/widgets')
      .set('Authorization', 'Bearer not-a-jwt')
      .expect(401);
  });
  it('persists widget and hides it from other organizations and personal scope', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/widgets')
      .set('Authorization', `Bearer ${a}`)
      .send({ name: 'Scoped widget' })
      .expect(201);
    expect(created.body).toMatchObject({
      name: 'Scoped widget',
      description: null,
      _links: { self: { href: `/v1/widgets/${created.body.id}` } },
    });
    const id = created.body.id as string;
    const read = await request(app.getHttpServer())
      .get(`/v1/widgets/${id}`)
      .set('Authorization', `Bearer ${a}`)
      .expect(200);
    expect(read.body.name).toBe('Scoped widget');
    const list = await request(app.getHttpServer())
      .get('/v1/widgets')
      .set('Authorization', `Bearer ${a}`)
      .expect(200);
    expect(list.body.some((widget: { id: string }) => widget.id === id)).toBe(
      true,
    );
    for (const token of [b, personal]) {
      await request(app.getHttpServer())
        .get(`/v1/widgets/${id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
      const otherList = await request(app.getHttpServer())
        .get('/v1/widgets')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(
        otherList.body.some((widget: { id: string }) => widget.id === id),
      ).toBe(false);
    }
  });
  it('rejects invalid creation payload without inserting widget', async () => {
    await request(app.getHttpServer())
      .post('/v1/widgets')
      .set('Authorization', `Bearer ${a}`)
      .send({ name: '', organizationId: 'org_b' })
      .expect(400);
  });
});
