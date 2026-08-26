import assert from 'node:assert/strict';
import { test } from 'node:test';
import Fastify from 'fastify';
import { ReadinessRegistry, registerReadiness } from './index.js';

void test('considera pronto quando todos os probes obrigatórios respondem', async () => {
  const readiness = new ReadinessRegistry();

  readiness.register({ name: 'sync', check: () => true });
  readiness.register({ name: 'async', check: () => Promise.resolve(true) });

  assert.equal(await readiness.isReady(), true);
});

void test('considera indisponível retorno falso ou exceção de probe', async () => {
  const unavailable = new ReadinessRegistry();
  unavailable.register({ name: 'unavailable', check: () => false });

  const failing = new ReadinessRegistry();
  failing.register({
    name: 'failing',
    check: () => {
      throw new Error('diagnóstico interno');
    },
  });

  assert.equal(await unavailable.isReady(), false);
  assert.equal(await failing.isReady(), false);
});

void test('rejeita nomes vazios e duplicados para evitar probes ambíguos', () => {
  const readiness = new ReadinessRegistry();

  assert.throws(
    () => readiness.register({ name: '  ', check: () => true }),
    RangeError
  );

  readiness.register({ name: 'database', check: () => true });
  assert.throws(
    () => readiness.register({ name: 'database', check: () => true }),
    /já foi registrado/
  );
});

void test('permanece indisponível desde o início do shutdown', async () => {
  const server = Fastify({ logger: false });
  await server.register(registerReadiness);

  assert.equal(await server.readiness.isReady(), true);

  await server.close();

  assert.equal(await server.readiness.isReady(), false);
});
