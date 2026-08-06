#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(__filename);
const srcDir = path.resolve(scriptsDir, '..');
const runtimeIndex = fs.readFileSync(path.join(srcDir, '.runtime-index.js'), 'utf8');
const runtimeIa = fs.readFileSync(path.join(srcDir, 'funcs', 'private', '.runtime-ia.js'), 'utf8');

const checks = [
  [runtimeIndex.includes('resolveCommandInput'), 'roteamento determinístico dos aliases'],
  [runtimeIndex.includes('loadSafeCommandAliases'), 'migração segura de commandAliases.json'],
  [runtimeIndex.includes("case 'd': {"), 'alias d ligado ao delete corrigido'],
  [runtimeIndex.includes('getQuotedContextInfo(info.message)'), 'delete reconhece mensagem citada'],
  [runtimeIndex.includes('reply(respAssist.message)'), 'erro da IA chega ao usuário'],
  [runtimeIa.includes('requestNvidiaChat'), 'cliente NVIDIA robusto carregado'],
  [runtimeIa.includes('function getNvidiaApiKey()'), 'chave NVIDIA lida dinamicamente'],
  [runtimeIa.includes('[NVIDIA] Erro na assistente'), 'log identifica NVIDIA corretamente'],
  [!runtimeIa.includes('Erro na API Cognima'), 'log legado da Cognima removido'],
  [!runtimeIa.includes('Tentativa ${attempt + 1} falhou'), 'repetição legada removida']
];

let failures = 0;
for (const [passed, description] of checks) {
  if (passed) console.log(`✅ ${description}`);
  else {
    failures += 1;
    console.error(`❌ ${description}`);
  }
}

console.log(`\nCorreções críticas: ${checks.length - failures} aprovadas, ${failures} falhas.`);
process.exit(failures ? 1 : 0);
