#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

import { loadLocalEnv, ROOT_DIR } from './envLoader.js';
import { prepareRuntimeSources } from './prepareRuntimeSources.js';
import { finalizeGyomeiRuntime } from './finalizeGyomeiRuntime.js';
import { buildAssistantSystemPrompt } from '../utils/gyomeiRuntime.js';

const MODEL = 'meta/llama-3.1-8b-instruct';
const CONFIG_FILE = path.join(ROOT_DIR, 'dados', 'src', 'config.json');
const RUNTIME_IA_FILE = path.join(
  ROOT_DIR,
  'dados',
  'src',
  'funcs',
  'private',
  '.runtime-ia.js'
);

function fail(message, details = null) {
  console.error(`❌ ${message}`);
  if (details) console.error(details);
  process.exit(1);
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (error) {
    fail(`Não foi possível ler config.json: ${error.message}`);
  }
}

function isPlaceholder(value) {
  const text = String(value || '').trim();
  return !text || /COLOQUE|SUA?_CHAVE|PLACEHOLDER|EXEMPLO/i.test(text);
}

function responseTextFrom(result) {
  return String(
    result?.data?.choices?.[0]?.message?.content
    || ''
  ).trim();
}

function parseAssistantJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    const preview = raw.length > 1200 ? `${raw.slice(0, 1200)}\n[prévia limitada]` : raw;
    fail(
      'A NVIDIA respondeu, mas o conteúdo não respeitou o JSON obrigatório da Nazuna.',
      `Erro de parse: ${error.message}\nResposta recebida:\n${preview}`
    );
  }
}

console.log('\n🤖 Validação autenticada da assistente NVIDIA\n');

loadLocalEnv();
const config = readConfig();
const apiKey = String(
  process.env.NVIDIA_API_KEY
  || config.nvidia_api_key
  || ''
).trim();

if (isPlaceholder(apiKey)) {
  fail(
    'NVIDIA_API_KEY não foi configurada. Defina-a em .env.local ou no ambiente antes do teste.'
  );
}

// Garante que o módulo runtime use a mesma credencial resolvida pelo validador.
process.env.NVIDIA_API_KEY = apiKey;

try {
  prepareRuntimeSources();
  finalizeGyomeiRuntime();
} catch (error) {
  fail(`Falha ao gerar o runtime da Nazuna 9.0: ${error.message}`);
}

if (!fs.existsSync(RUNTIME_IA_FILE)) {
  fail('O módulo runtime da IA não foi gerado.');
}

const runtimeSource = fs.readFileSync(RUNTIME_IA_FILE, 'utf8');
if (!runtimeSource.includes(MODEL)) {
  fail(`O runtime não está configurado com o modelo ${MODEL}.`);
}
if (!runtimeSource.includes('process.env.NVIDIA_API_KEY')) {
  fail('O runtime da IA não está lendo NVIDIA_API_KEY do ambiente.');
}
if (/nvapi-[A-Za-z0-9_-]+/.test(runtimeSource)) {
  fail('O runtime gerado contém uma chave NVIDIA hardcoded.');
}

let makeCognimaRequest;
try {
  const runtimeUrl = `${pathToFileURL(RUNTIME_IA_FILE).href}?validation=${Date.now()}`;
  ({ makeCognimaRequest } = await import(runtimeUrl));
} catch (error) {
  fail(`Não foi possível importar o módulo runtime da IA: ${error.message}`);
}

if (typeof makeCognimaRequest !== 'function') {
  fail('makeCognimaRequest não foi exportada pelo módulo runtime.');
}

const systemPrompt = buildAssistantSystemPrompt('nazuna', '');
const userInput = {
  texto: 'Qual é o seu nome? Depois comente brevemente: hoje o grupo está silencioso.',
  origem: 'validacao_integracao_nvidia',
  tem_midia: false,
  mencoes: []
};

const startedAt = Date.now();
let result;
try {
  result = await makeCognimaRequest(
    MODEL,
    JSON.stringify(userInput),
    systemPrompt,
    [],
    1
  );
} catch (error) {
  fail(`A chamada pelo fluxo real da Nazuna falhou: ${error.message}`);
}

const latencyMs = Date.now() - startedAt;
if (result?.success !== true) {
  fail('makeCognimaRequest não retornou success: true.');
}

const rawContent = responseTextFrom(result);
if (!rawContent) {
  fail('A resposta da NVIDIA não contém choices[0].message.content.');
}

const parsed = parseAssistantJson(rawContent);
if (!Array.isArray(parsed?.resp) || parsed.resp.length === 0) {
  fail('O JSON retornado não contém um array resp com pelo menos uma mensagem.');
}

const messages = parsed.resp
  .map(item => String(item?.resp || '').trim())
  .filter(Boolean);

if (!messages.length) {
  fail('O array resp não contém texto utilizável.');
}

const joined = messages.join(' ');
if (!/\bGYOMEI\b/i.test(joined)) {
  fail('A assistente respondeu, mas não assumiu o nome GYOMEI.', joined);
}

const randomOfferPatterns = [
  /em que posso ajudar/i,
  /como posso ajudar/i,
  /posso ajudar (?:em|com|você)/i,
  /precisa de ajuda com/i
];

const randomOffer = randomOfferPatterns.find(pattern => pattern.test(joined));
if (randomOffer) {
  fail('A assistente voltou a oferecer ajuda aleatória em conversa casual.', joined);
}

const returnedModel = String(result?.data?.model || MODEL);
console.log('✅ Endpoint NVIDIA respondeu pelo módulo real da Nazuna.');
console.log(`✅ Modelo retornado: ${returnedModel}`);
console.log(`✅ Contrato JSON válido com ${messages.length} mensagem(ns).`);
console.log('✅ Identidade GYOMEI confirmada.');
console.log('✅ Nenhuma oferta genérica de ajuda foi detectada.');
console.log(`✅ Latência total: ${latencyMs} ms`);
console.log(`📝 Prévia: ${joined.slice(0, 500)}`);
console.log('\n✅ Fluxo NVIDIA + prompt + resposta da assistente aprovado.');

process.exit(0);
