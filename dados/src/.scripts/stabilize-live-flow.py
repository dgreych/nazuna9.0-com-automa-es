from pathlib import Path
import re, json
root=Path.cwd()

# --- ia.js ---
p=root/'dados/src/funcs/private/ia.js'
s=p.read_text()
s=s.replace("import axios from 'axios';\n", "")
old="import userContextDB from '../../utils/userContextDB.js';"
new="import userContextDB from '../../utils/userContextDB.js';\nimport * as automacoesV9 from '../../utils/gyomeiRuntime.js';\nimport { DEFAULT_NVIDIA_MODEL, requestNvidiaChat } from '../../utils/nvidiaApi.js';"
if new not in s:
    assert old in s
    s=s.replace(old,new,1)
old_key="// Chave de IA hardcoded\nconst IA_API_KEY = String(process.env.NVIDIA_API_KEY || '').trim();"
new_key="""function getNvidiaApiKey() {
  return String(
    process.env.NVIDIA_API_KEY
    || automacoesV9.getConfig()?.nvidia_api_key
    || ''
  ).trim();
}"""
assert old_key in s
s=s.replace(old_key,new_key,1)
pattern=r"async function makeCognimaRequest\(modelo, texto, systemPrompt = null, historico = \[\], retries = 3\) \{[\s\S]*?\n\}\n\nfunction cleanWhatsAppFormatting"
replacement="""async function makeNvidiaRequest(modelo, texto, systemPrompt = null, historico = [], retries = 3) {
  if (!texto) {
    throw new Error('Parâmetro obrigatório ausente: texto');
  }

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
  if (Array.isArray(historico) && historico.length > 0) messages.push(...historico);
  messages.push({ role: 'user', content: texto });

  return requestNvidiaChat({
    apiKey: getNvidiaApiKey(),
    model: modelo || DEFAULT_NVIDIA_MODEL,
    messages,
    temperature: 0.7,
    maxTokens: 2000,
    retries
  });
}

// Compatibilidade temporária com comandos legados que ainda usam o nome antigo.
const makeCognimaRequest = makeNvidiaRequest;

function cleanWhatsAppFormatting"""
s2,n=re.subn(pattern,replacement,s,count=1)
assert n==1, n
s=s2
old_fallback="""  console.error('❌ Não foi possível extrair JSON válido da resposta.');
  console.error('Conteúdo recebido (primeiros 200 chars):', content.substring(0, 200) + '...');
  
  // Retornar o conteúdo limpo como resposta de fallback
  return { resp: [{ resp: cleanWhatsAppFormatting(cleanContent) || \"Não entendi a resposta, pode tentar de novo?\" }] };"""
new_fallback="""  const fallbackText = cleanWhatsAppFormatting(cleanContent);
  const lookedLikeJson = /^[\\[{]/.test(cleanContent);

  if (lookedLikeJson) {
    console.warn('⚠️ A NVIDIA retornou JSON malformado; usando o conteúdo textual como fallback.');
  } else {
    console.log('ℹ️ Resposta textual recebida; normalizando para o formato interno da assistente.');
  }

  return { resp: [{ resp: fallbackText || 'Não entendi a resposta, pode tentar de novo?' }] };"""
assert old_fallback in s
s=s.replace(old_fallback,new_fallback,1)
s=s.replace("const response = (await makeCognimaRequest(\n          'meta/llama-3.1-70b-instruct',", "const response = (await makeNvidiaRequest(\n          'meta/llama-3.1-70b-instruct',",1)
s=s.replace('throw new Error("Resposta da API Cognima foi inválida ou vazia.");','throw new Error("Resposta da API NVIDIA foi inválida ou vazia.");',1)
old_catch="""        console.error('Erro na API Cognima:', apiError.message);
        
        return {
          resp: [],
          erro: 'Erro temporário',
          message: '🌙 *Ops! Algo deu errado aqui...*\\n\\n😢 N-Não sei bem o que aconteceu... tô meio confusa agora.\\n\\n⏰ Tenta de novo em um pouquinho?'
        };"""
new_catch="""        console.error('[NVIDIA] Erro na assistente:', {
          code: apiError.code,
          status: apiError.status,
          message: apiError.message
        });

        return {
          resp: [],
          erro: apiError.code || 'NVIDIA_REQUEST_FAILED',
          status: apiError.status || null,
          message: apiError.userMessage || '🤖 A assistente está temporariamente indisponível. Tente novamente em alguns instantes.'
        };"""
assert old_catch in s
s=s.replace(old_catch,new_catch,1)
s=s.replace("  makeCognimaRequest,\n", "  makeNvidiaRequest,\n  makeCognimaRequest,\n  extractJSON,\n",1)
p.write_text(s)

# --- index.js direct critical fixes ---
p=root/'dados/src/index.js'
s=p.read_text()
old="import * as ia from './funcs/private/ia.js';"
new="import * as ia from './funcs/private/ia.js';\nimport { getQuotedContextInfo, loadSafeCommandAliases, resolveCommandInput } from './utils/commandResolver.js';"
if new not in s:
    assert old in s
    s=s.replace(old,new,1)
old_alias="""    const aliases = loadCommandAliases();
    const matchedAlias = aliases.find(item => normalizar(bodyWithoutPrefix.split(/ +/).shift().trim()) === item.alias);"""
new_alias="""    const aliases = loadSafeCommandAliases();
    const rawCommandToken = bodyWithoutPrefix.split(/ +/).shift().trim();
    const commandResolution = resolveCommandInput(rawCommandToken, aliases);
    const matchedAlias = commandResolution.matchedAlias;"""
assert old_alias in s
s=s.replace(old_alias,new_alias,1)
old_cmd="    var command = isCmd ? matchedAlias ? matchedAlias.command : normalizar(bodyWithoutPrefix.split(/ +/).shift().trim()).replace(/\\s+/g, '') : null;"
new_cmd="    var command = isCmd ? commandResolution.command : null;"
assert old_cmd in s
s=s.replace(old_cmd,new_cmd,1)
old_resp="""    } else {
      console.warn(`⚠️ [${personality}] Nenhuma resposta válida retornada pela IA. respAssist.resp:`, respAssist.resp);
    }"""
new_resp="""    } else if (respAssist?.message) {
      console.warn(`⚠️ [${personality}] A IA falhou sem respostas válidas:`, respAssist.erro || 'erro desconhecido');
      reply(respAssist.message);
    } else {
      console.warn(`⚠️ [${personality}] Nenhuma resposta válida retornada pela IA. respAssist.resp:`, respAssist.resp);
    }"""
assert old_resp in s
s=s.replace(old_resp,new_resp,1)
pat=r"case 'deletar':\ncase 'delete':\ncase 'del':\ncase 'd':[\s\S]*?\n\s*break;"
repl="""case 'deletar':
case 'delete':
case 'del':
case 'd': {
    if (!isGroup) return reply('❌ O comando de apagar mensagens só funciona em grupos.');
    if (!isGroupAdmin) return reply('🚫 Comando restrito a administradores ou moderadores autorizados.');

    const quotedContextInfo = getQuotedContextInfo(info.message);
    const stanzaId = quotedContextInfo?.stanzaId;
    const participant = quotedContextInfo?.participant || menc_prt || null;

    if (!stanzaId) {
      return reply(`↩️ Responda à mensagem que deseja apagar e use *${groupPrefix}d*.`);
    }

    const participantIsBot = participant
      ? [nazu.user?.id, nazu.user?.lid, botNumber, botNumberLid]
        .filter(Boolean)
        .some(botId => idsMatch(botId, participant))
      : false;

    if (!participantIsBot && !isBotAdmin) {
      return reply('⚠️ Preciso ser administrador do grupo para apagar mensagens de outras pessoas.');
    }

    try {
      const deleteKey = {
        remoteJid: from,
        fromMe: participantIsBot,
        id: stanzaId
      };
      if (participant && !participantIsBot) deleteKey.participant = participant;

      await nazu.sendMessage(from, { delete: deleteKey });
    } catch (error) {
      console.error('[DELETE] Falha ao apagar mensagem:', {
        message: error.message,
        stanzaId,
        participant
      });
      await reply('❌ Não consegui apagar essa mensagem. Verifique se ainda sou administrador e tente novamente.');
    }
       break;
}"""
s2,n=re.subn(pat,repl,s,count=1)
assert n==1,n
s=s2
p.write_text(s)

# --- prepareRuntimeSources.js ---
p=root/'dados/src/.scripts/prepareRuntimeSources.js'
s=p.read_text()
old_block="""  output = replaceRequired(
    output,
    `import userContextDB from '../../utils/userContextDB.js';`,
    `import userContextDB from '../../utils/userContextDB.js';\\nimport * as automacoesV9 from '../../utils/gyomeiRuntime.js';`,
    'import das configurações do Gyomei na IA'
  );

  if (output.includes('moonshotai/kimi-k2-instruct')) {
    output = output.replaceAll('moonshotai/kimi-k2-instruct', 'meta/llama-3.1-70b-instruct');
  } else if (!output.includes('meta/llama-3.1-70b-instruct')) {
    throw new Error('Patch obrigatório não encontrado: modelo de IA conhecido');
  }"""
new_block="""  if (!output.includes(`import * as automacoesV9 from '../../utils/gyomeiRuntime.js';`)) {
    output = replaceRequired(
      output,
      `import userContextDB from '../../utils/userContextDB.js';`,
      `import userContextDB from '../../utils/userContextDB.js';\\nimport * as automacoesV9 from '../../utils/gyomeiRuntime.js';`,
      'import das configurações do Gyomei na IA'
    );
  }

  if (output.includes('moonshotai/kimi-k2-instruct')) {
    throw new Error('Modelo descontinuado encontrado diretamente na fonte da IA.');
  }
  if (!output.includes('meta/llama-3.1-70b-instruct') && !output.includes('DEFAULT_NVIDIA_MODEL')) {
    throw new Error('Modelo NVIDIA padrão não encontrado na fonte da IA.');
  }"""
assert old_block in s
s=s.replace(old_block,new_block,1)
old_idx="""  if (output.includes('moonshotai/kimi-k2-instruct')) {
    output = output.replaceAll('moonshotai/kimi-k2-instruct', 'meta/llama-3.1-70b-instruct');
  }

  output = replaceRequired("""
new_idx="""  if (output.includes('moonshotai/kimi-k2-instruct')) {
    throw new Error('Modelo descontinuado encontrado diretamente na fonte principal.');
  }

  output = replaceRequired("""
assert old_idx in s
s=s.replace(old_idx,new_idx,1)
p.write_text(s)

# --- applyCriticalRuntimeFixes.js ---
p=root/'dados/src/.scripts/applyCriticalRuntimeFixes.js'
s=p.read_text()
s=s.replace("/async function makeCognimaRequest\\(modelo, texto, systemPrompt = null, historico = \\[\\], retries = 3\\) \\{[\\s\\S]*?\\n\\}\\n\\nfunction cleanWhatsAppFormatting/", "/async function (?:makeCognimaRequest|makeNvidiaRequest)\\(modelo, texto, systemPrompt = null, historico = \\[\\], retries = 3\\) \\{[\\s\\S]*?\\n\\}(?:\\n\\n\\/\\/ Compatibilidade temporária[\\s\\S]*?const makeCognimaRequest = makeNvidiaRequest;)?\\n\\nfunction cleanWhatsAppFormatting/")
s=s.replace("`async function makeCognimaRequest(modelo, texto, systemPrompt = null, historico = [], retries = 3) {", "`async function makeNvidiaRequest(modelo, texto, systemPrompt = null, historico = [], retries = 3) {")
s=s.replace("}\n\nfunction cleanWhatsAppFormatting`", "}\n\n// Compatibilidade temporária com comandos legados que ainda usam o nome antigo.\nconst makeCognimaRequest = makeNvidiaRequest;\n\nfunction cleanWhatsAppFormatting`")
old_log_patch = """  output = replaceRequired(
    output,
    `        console.error('Erro na API Cognima:', apiError.message);`,
    `        console.error('[NVIDIA] Erro na assistente:', { code: apiError.code, status: apiError.status, message: apiError.message });`,
    'identificação correta da API nos logs'
  );"""
new_log_patch = """  if (!output.includes(\"[NVIDIA] Erro na assistente:\")) {
    output = replaceRequired(
      output,
      `        console.error('Erro na API Cognima:', apiError.message);`,
      `        console.error('[NVIDIA] Erro na assistente:', { code: apiError.code, status: apiError.status, message: apiError.message });`,
      'identificação correta da API nos logs'
    );
  }"""
if old_log_patch in s:
    s = s.replace(old_log_patch, new_log_patch, 1)
p.write_text(s)

# --- vipCommandsManager.js ---
p = root / 'dados/src/utils/vipCommandsManager.js'
s = p.read_text()
if '  normalizeVipCommandsData,\n' not in s:
    s = s.replace('export {\n', 'export {\n  normalizeVipCommandsData,\n', 1)
p.write_text(s)

# --- live test ---
p=root/'dados/src/.scripts/test-assistant-live.js'
p.write_text("""#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

import { loadLocalEnv, ROOT_DIR } from './envLoader.js';

loadLocalEnv();

const apiKey = String(process.env.NVIDIA_API_KEY || '').trim();
if (!apiKey) {
  console.error('❌ Defina NVIDIA_API_KEY somente no ambiente antes de executar este teste.');
  process.exit(1);
}

const contextFile = path.join(ROOT_DIR, 'dados', 'database', 'userContext.json');
const contextExisted = fs.existsSync(contextFile);
const contextBackup = contextExisted ? fs.readFileSync(contextFile) : null;
const testUser = `live-test-${Date.now()}`;

function restoreContext() {
  try {
    if (contextExisted && contextBackup) {
      fs.mkdirSync(path.dirname(contextFile), { recursive: true });
      fs.writeFileSync(contextFile, contextBackup);
    } else if (fs.existsSync(contextFile)) {
      fs.rmSync(contextFile, { force: true });
    }
  } catch (error) {
    console.error(`⚠️ Não foi possível restaurar userContext.json: ${error.message}`);
  }
}

try {
  const { makeAssistentRequest } = await import('../funcs/private/ia.js');
  console.log('🔎 Testando o fluxo completo da assistente com NVIDIA/Llama 3.1 70B...');

  const result = await makeAssistentRequest(
    {
      mensagens: [{
        texto: 'Siga seu formato JSON obrigatório. Na primeira resposta, escreva exatamente: FLUXO NAZUNA OK',
        id_enviou: testUser,
        nome_enviou: 'Teste Local',
        id_grupo: 'teste-local@g.us',
        nome_grupo: 'Teste Local',
        tem_midia: false,
        marcou_mensagem: false,
        marcou_sua_mensagem: false,
        tem_midia_marcada: false,
        id_mensagem: `msg-${Date.now()}`
      }]
    },
    null,
    null,
    'nazuna'
  );

  if (!result || !Array.isArray(result.resp) || result.resp.length === 0) {
    throw new Error(`A assistente não retornou respostas válidas: ${JSON.stringify(result)}`);
  }

  const texts = result.resp
    .map(item => typeof item === 'string' ? item : item?.resp)
    .filter(value => typeof value === 'string' && value.trim());

  if (!texts.some(text => text.includes('FLUXO NAZUNA OK'))) {
    throw new Error(`A resposta não confirmou o fluxo: ${JSON.stringify(result)}`);
  }

  console.log('✅ Fluxo completo aprovado.');
  console.log(`🤖 Resposta recebida: ${texts.join(' | ')}`);
} catch (error) {
  console.error('❌ Fluxo completo da assistente reprovado:', {
    name: error.name,
    code: error.code,
    status: error.status || error.response?.status,
    message: error.message
  });
  process.exitCode = 1;
} finally {
  await new Promise(resolve => setTimeout(resolve, 2500));
  restoreContext();
}
""")

# --- package scripts ---
p=root/'package.json'
data=json.loads(p.read_text())
data['scripts']['test:nvidia:live']='node dados/src/.scripts/diagnose-nvidia.js'
data['scripts']['test:assistant:live']='node dados/src/.scripts/test-assistant-live.js'
p.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n")

# --- tests ---
p=root/'dados/src/.scripts/test-regressions.js'
s=p.read_text()
s=s.replace("import { requestNvidiaChat } from '../utils/nvidiaApi.js';", "import { requestNvidiaChat } from '../utils/nvidiaApi.js';\nimport { extractJSON } from '../funcs/private/ia.js';\nimport { getQuotedMediaSource } from '../utils/gyomeiCore.js';\nimport { normalizeVipCommandsData } from '../utils/vipCommandsManager.js';")
insert="""
await test('fonte principal já contém as correções críticas, sem depender da runtime', () => {
  const iaSource = fs.readFileSync(new URL('../funcs/private/ia.js', import.meta.url), 'utf8');
  const indexSource = fs.readFileSync(new URL('../index.js', import.meta.url), 'utf8');
  const prepareSource = fs.readFileSync(new URL('./prepareRuntimeSources.js', import.meta.url), 'utf8');

  assert.ok(iaSource.includes('requestNvidiaChat'));
  assert.ok(iaSource.includes('makeNvidiaRequest'));
  assert.ok(!iaSource.includes(\"import axios from 'axios'\"));
  assert.ok(!iaSource.includes('Erro na API Cognima'));
  assert.ok(!iaSource.includes('Resposta da API Cognima'));
  assert.ok(indexSource.includes('loadSafeCommandAliases'));
  assert.ok(indexSource.includes(\"case 'd': {\"));
  assert.ok(indexSource.includes('getQuotedContextInfo(info.message)'));
  assert.ok(!prepareSource.includes(\"replaceAll('moonshotai/kimi-k2-instruct'\"));
});

await test('resposta textual da NVIDIA é normalizada sem perder conteúdo', () => {
  assert.deepEqual(extractJSON('FLUXO NAZUNA OK'), {
    resp: [{ resp: 'FLUXO NAZUNA OK' }]
  });
});

await test('comandos VIP normalizam bancos vazios e formatos antigos', () => {
  const empty = normalizeVipCommandsData({});
  assert.deepEqual(empty.commands, []);
  assert.ok(empty.categories.ia);

  const legacy = normalizeVipCommandsData([{ command: 'play', enabled: true }]);
  assert.equal(legacy.commands.length, 1);
  assert.equal(legacy.commands[0].command, 'play');
});

await test('setmidia reconhece imagem e GIF citados', () => {
  const image = { url: 'imagem', mediaKey: Buffer.from('x') };
  const gif = { url: 'video', mediaKey: Buffer.from('y'), gifPlayback: true };

  assert.deepEqual(
    getQuotedMediaSource({ extendedTextMessage: { contextInfo: { quotedMessage: { imageMessage: image } } } }),
    { message: image, type: 'image', gifPlayback: false }
  );
  assert.deepEqual(
    getQuotedMediaSource({ extendedTextMessage: { contextInfo: { quotedMessage: { videoMessage: gif } } } }),
    { message: gif, type: 'video', gifPlayback: true }
  );
});

"""
marker="await test('HTTP 410 da NVIDIA não é repetido três vezes'"
assert marker in s
s=s.replace(marker,insert+marker,1)
p.write_text(s)

print('patched')
