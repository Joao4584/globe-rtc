import { Controller, Post } from '@nestjs/common';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { deriveInternalApiKey } from '@globe-rtc/env/dist/internal-key';
import { InternalOnly } from '@/presentation/decorators/internal-only.decorator';

// Rota de teste protegida com o mesmo decorator usado em /user/integration.
@Controller('internal-test')
class InternalTestController {
  @Post()
  @InternalOnly()
  handle() {
    return { ok: true };
  }
}

const SECRET = 'segredo-do-nextauth-de-teste-com-mais-de-32-caracteres';
const KEY = deriveInternalApiKey(SECRET);

describe('InternalOnlyGuard', () => {
  let app: NestFastifyApplication;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ controllers: [InternalTestController] }).compile();
    app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    // Cada teste mexe nas variaveis de ambiente; volta ao estado original para nao vazar para o proximo.
    process.env = { ...originalEnv };
  });

  const call = (headers: Record<string, string> = {}) => app.inject({ method: 'POST', url: '/internal-test', headers });

  const asProduction = () => {
    process.env.NODE_ENV = 'production';
    process.env.NEXTAUTH_SECRET = SECRET;
  };

  it('em producao libera a chamada quando o header x-internal-key e a chave derivada do NEXTAUTH_SECRET', async () => {
    asProduction();
    const response = await call({ 'x-internal-key': KEY });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ ok: true });
  });

  it('em producao bloqueia com 403 quando o header nao e enviado (ex.: alguem chamando a API de fora)', async () => {
    asProduction();
    const response = await call();
    expect(response.statusCode).toBe(403);
    expect(response.json().code).toBe('FORBIDDEN');
  });

  it('em producao bloqueia com 403 chave errada, de tamanho igual ou diferente, e header vazio', async () => {
    asProduction();
    expect((await call({ 'x-internal-key': KEY.slice(0, -1) + (KEY.endsWith('0') ? '1' : '0') })).statusCode).toBe(403);
    expect((await call({ 'x-internal-key': 'curto' })).statusCode).toBe(403);
    expect((await call({ 'x-internal-key': '' })).statusCode).toBe(403);
  });

  it('o proprio NEXTAUTH_SECRET enviado cru nao vale: so a chave derivada abre a rota', async () => {
    asProduction();
    expect((await call({ 'x-internal-key': SECRET })).statusCode).toBe(403);
  });

  it('em producao sem NEXTAUTH_SECRET recusa tudo (falha fechada), mesmo com header', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXTAUTH_SECRET;
    expect((await call()).statusCode).toBe(403);
    expect((await call({ 'x-internal-key': KEY })).statusCode).toBe(403);
  });

  it('sem NODE_ENV definido trata como producao e exige a chave (nao abre por esquecimento)', async () => {
    process.env.NEXTAUTH_SECRET = SECRET;
    delete process.env.NODE_ENV;
    expect((await call()).statusCode).toBe(403);
    expect((await call({ 'x-internal-key': KEY })).statusCode).toBe(201);
  });

  it('em desenvolvimento aceita sem header (Swagger, Bruno e curl continuam funcionando)', async () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXTAUTH_SECRET = SECRET;
    expect((await call()).statusCode).toBe(201);
    expect((await call({ 'x-internal-key': '' })).statusCode).toBe(201);
  });

  it('em desenvolvimento, se o header for enviado ele precisa estar certo', async () => {
    process.env.NODE_ENV = 'development';
    process.env.NEXTAUTH_SECRET = SECRET;
    expect((await call({ 'x-internal-key': KEY })).statusCode).toBe(201);
    expect((await call({ 'x-internal-key': 'chave-errada' })).statusCode).toBe(403);
  });

  it('em desenvolvimento sem NEXTAUTH_SECRET deixa passar', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.NEXTAUTH_SECRET;
    expect((await call()).statusCode).toBe(201);
  });
});
