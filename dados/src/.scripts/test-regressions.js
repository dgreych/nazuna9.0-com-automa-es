#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { getQuotedContextInfo, loadSafeCommandAliases, normalizeCommandAliases, resolveCommandInput } from '../utils/commandResolver.js';
import { requestNvidiaChat } from '../utils/nvidiaApi.js';

const results = [];
async function test(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`✅ ${name}`);
  } catch (error) {
    results.push({ name, ok: false, error });
    console.error(`❌ ${name}: ${error.message}`);
  }
}

await test('alias oficial d resolve sempre para delete', () => {
  const result = resolveCommandInput('d', [{ alias: 'd', command: 'menu' }]);
  assert.equal(result.command, 'delete');
  assert.equal(result.source, 'builtin');
});

await test('formatos antigos de aliases são normalizados', () => {
  assert.deepEqual(normalizeCommandAliases([]), []);
  assert.deepEqual(normalizeCommandAliases({}), []);
  assert.deepEqual(normalizeCommandAliases({ aliases: [{ alias: 'Oi', command: 'Menu' }] }), [
    { alias: 'oi', command: 'menu', fixedParams: '' }
  ]);
});

await test('commandAliases.json antigo é migrado em disco', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nazuna-alias-'));
  const file = path.join(tempDir, 'commandAliases.json');
  fs.writeFileSync(file, '[]');
  assert.deepEqual(loadSafeCommandAliases(file), []);
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { aliases: [] });
  fs.rmSync(tempDir, { recursive: true, force: true });
});

await test('aliases inválidos e reservados são descartados', () => {
  const aliases = normalizeCommandAliases({ aliases: [
    null,
    { alias: 'd', command: 'menu' },
    { alias: '', command: 'menu' },
    { alias: 'ajuda', command: 'menu' }
  ] });
  assert.equal(aliases.length, 1);
  assert.equal(aliases[0].alias, 'ajuda');
});

await test('contexto de mensagem citada é reconhecido em texto e mídia', () => {
  const textContext = { stanzaId: 'ABC', participant: '1@s.whatsapp.net' };
  assert.equal(getQuotedContextInfo({ extendedTextMessage: { contextInfo: textContext } }), textContext);

  const imageContext = { stanzaId: 'DEF', participant: '2@s.whatsapp.net' };
  assert.equal(getQuotedContextInfo({ imageMessage: { contextInfo: imageContext } }), imageContext);

  const wrappedContext = { stanzaId: 'GHI', participant: '3@s.whatsapp.net' };
  assert.equal(getQuotedContextInfo({
    viewOnceMessageV2: { message: { videoMessage: { contextInfo: wrappedContext } } }
  }), wrappedContext);
});


await test('fontes usam Llama 3.1 70B sem depender de patch no startup', () => {
  const iaSource = fs.readFileSync(new URL('../funcs/private/ia.js', import.meta.url), 'utf8');
  const indexSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  assert.ok(iaSource.includes('meta/llama-3.1-70b-instruct'));
  assert.ok(indexSource.includes('meta/llama-3.1-70b-instruct'));
  assert.ok(!iaSource.includes('moonshotai/kimi-k2-instruct'));
  assert.ok(!indexSource.includes('moonshotai/kimi-k2-instruct'));
});

await test('HTTP 410 da NVIDIA não é repetido três vezes', async () => {
  let calls = 0;
  const httpClient = {
    async post() {
      calls += 1;
      const error = new Error('Gone');
      error.response = { status: 410, data: { message: 'Gone' } };
      throw error;
    }
  };

  await assert.rejects(
    requestNvidiaChat({
      apiKey: 'test-key',
      messages: [{ role: 'user', content: 'teste' }],
      retries: 3,
      httpClient,
      retryDelay: async () => {}
    }),
    error => error.code === 'NVIDIA_ACCESS_GONE' && error.retryable === false
  );
  assert.equal(calls, 1);
});

await test('falha transitória da NVIDIA é repetida e pode recuperar', async () => {
  let calls = 0;
  const httpClient = {
    async post() {
      calls += 1;
      if (calls === 1) {
        const error = new Error('temporário');
        error.response = { status: 503, data: { message: 'temporário' } };
        throw error;
      }
      return { data: { choices: [{ message: { content: 'ok' } }] } };
    }
  };

  const response = await requestNvidiaChat({
    apiKey: 'test-key',
    messages: [{ role: 'user', content: 'teste' }],
    retries: 3,
    httpClient,
    retryDelay: async () => {}
  });
  assert.equal(response.data.choices[0].message.content, 'ok');
  assert.equal(calls, 2);
});

await test('chave NVIDIA ausente falha antes da rede', async () => {
  let calls = 0;
  const httpClient = { async post() { calls += 1; } };
  await assert.rejects(
    requestNvidiaChat({
      apiKey: '',
      messages: [{ role: 'user', content: 'teste' }],
      httpClient
    }),
    error => error.code === 'NVIDIA_KEY_MISSING'
  );
  assert.equal(calls, 0);
});

const failures = results.filter(item => !item.ok);
console.log(`\nRegressões: ${results.length - failures.length} aprovadas, ${failures.length} falhas.`);
process.exit(failures.length ? 1 : 0);
