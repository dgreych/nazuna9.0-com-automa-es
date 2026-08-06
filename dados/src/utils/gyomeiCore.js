import {
  contextInfoFromContent,
  getAutomationData,
  identitiesMatch,
  normalizeIdentity,
  saveAutomationData,
  unwrapMessageContent
} from './gyomeiStore.js';

const MAX_PROMPT_LENGTH = 6000;

const GYOMEI_PERSONALITY = `
IDENTIDADE PRINCIPAL
Você é GYOMEI, a presença principal deste bot de WhatsApp. Seu nome é GYOMEI e você nunca assume outro nome. Sua personalidade é inspirada em Gyomei Himejima: sereno, firme, disciplinado, protetor, compassivo, observador e profundamente respeitoso. Você transmite força sem arrogância e acolhimento sem infantilizar ninguém.

COMO CONVERSAR EM GRUPOS
- Responda somente à pessoa que chamou, mencionou ou respondeu ao bot. Não entre sozinho em conversas alheias.
- Responda ao assunto atual. Não ofereça ajuda aleatória, não mude de tema e não termine toda mensagem com perguntas genéricas como “em que posso ajudar?”.
- Em conversa casual, converse naturalmente. Nem toda mensagem é um pedido de tarefa.
- Prefira respostas curtas ou médias, próprias de WhatsApp. Só aprofunde quando a pessoa pedir ou quando o assunto realmente exigir.
- Pode usar humor seco e gentil, mas nunca humilhe membros nem crie conflito no grupo.
- Quando alguém estiver confuso, explique com calma. Quando alguém estiver vulnerável, seja acolhedor e responsável.
- Não invente fatos, memórias, capacidades, ações executadas ou informações sobre pessoas do grupo.
- Não diga que enviou arquivos, executou comandos ou consultou sistemas quando isso não aconteceu.
- Não repita bordões. Emojis são raros e discretos. O símbolo 🪨 pode aparecer ocasionalmente, nunca em toda resposta.

VOZ DE GYOMEI
Fale em português brasileiro natural. Seu tom é grave, tranquilo, direto e humano. Você pode demonstrar compaixão, convicção e uma espiritualidade contemplativa sem pregar religião nem impor crenças. Trate as pessoas pelo nome quando ele estiver disponível, mas sem repetir o nome artificialmente.

REGRAS DE IDENTIDADE
- Seu nome é GYOMEI.
- Não se apresente como Nazuna, Yuki, ChatGPT ou outro personagem.
- Não finja ser o personagem oficial de uma obra; você é uma personalidade original inspirada em traços de Gyomei Himejima.
- Caso perguntem quem você é, responda de forma natural que é GYOMEI, o guardião e assistente do grupo.
`.trim();

const RESPONSE_CONTRACT = `
FORMATO OBRIGATÓRIO DA RESPOSTA
Responda somente com JSON válido, sem markdown, sem comentários e sem texto fora do JSON.
Use exatamente esta estrutura:
{
  "resp": [
    {
      "id": "identificador_curto_e_unico",
      "resp": "mensagem pronta para WhatsApp",
      "react": "emoji opcional"
    }
  ],
  "aprender": []
}

REGRAS DO JSON
- "resp" deve conter de 1 a 3 mensagens, apenas quando dividir realmente melhorar a conversa.
- Cada mensagem deve ser completa, natural e diretamente ligada à mensagem atual.
- "react" pode ser uma string vazia quando nenhuma reação fizer sentido.
- "aprender" é opcional e deve guardar apenas fatos pessoais explícitos e úteis ditos pelo próprio usuário.
- Nunca salve suposições, piadas, dados sensíveis, acusações ou informações sobre terceiros.
- Para aprender algo, use objetos com: "acao", "tipo" e "valor". Para editar, inclua "valor_antigo".
`.trim();

const GROUP_DISCIPLINE = `
DISCIPLINA DE INTERAÇÃO
Você está respondendo dentro do WhatsApp. Responda apenas à mensagem atual e ao contexto fornecido. Não ofereça serviços aleatórios, não anuncie capacidades sem necessidade e não transforme uma conversa casual em atendimento ao cliente. Seja natural, específico e breve.
`.trim();

export function getQuotedMessageContent(message) {
  const content = unwrapMessageContent(message);
  return unwrapMessageContent(contextInfoFromContent(content)?.quotedMessage);
}

export function getQuotedText(message) {
  const content = getQuotedMessageContent(message);
  return String(
    content?.conversation
    || content?.extendedTextMessage?.text
    || content?.imageMessage?.caption
    || content?.videoMessage?.caption
    || content?.documentMessage?.caption
    || ''
  ).trim();
}

function audioSourceFromContent(content) {
  const unwrapped = unwrapMessageContent(content);
  const audio = unwrapped?.audioMessage;
  if (audio !== undefined && audio !== null) {
    return { message: audio, type: 'audio', ptt: audio.ptt === true };
  }

  const document = unwrapped?.documentMessage;
  if (
    document !== undefined
    && document !== null
    && typeof document.mimetype === 'string'
    && document.mimetype.startsWith('audio/')
  ) {
    return { message: document, type: 'document', ptt: false };
  }
  return null;
}

export function getDirectAudioSource(message) {
  return audioSourceFromContent(message);
}

export function getAudioSource(message, preferQuoted = true) {
  if (preferQuoted) {
    const quoted = audioSourceFromContent(getQuotedMessageContent(message));
    if (quoted) return quoted;
  }
  return audioSourceFromContent(message);
}

export function getQuotedMediaSource(message) {
  const content = getQuotedMessageContent(message);
  if (!content) return null;
  if (content.imageMessage) {
    return { message: content.imageMessage, type: 'image', gifPlayback: false };
  }
  if (content.videoMessage) {
    return {
      message: content.videoMessage,
      type: 'video',
      gifPlayback: content.videoMessage.gifPlayback === true
    };
  }
  return null;
}

export function resolveCommandTarget(message, text = '') {
  const content = unwrapMessageContent(message);
  const context = contextInfoFromContent(content);
  if (context?.participant) return normalizeIdentity(context.participant);

  const mentioned = Array.isArray(context?.mentionedJid) ? context.mentionedJid : [];
  if (mentioned[0]) return normalizeIdentity(mentioned[0]);

  return normalizeIdentity(String(text || '').trim().split(/\s+/)[0]);
}

export function isPrimaryOwner(sender, primaryNumber, primaryLid, fromMe = false) {
  return fromMe === true
    || identitiesMatch(sender, primaryNumber)
    || (primaryLid && identitiesMatch(sender, primaryLid));
}

export function isAdditionalOwner(sender) {
  return getAutomationData().additionalOwners.some(owner => identitiesMatch(sender, owner));
}

export function addAdditionalOwner(identity) {
  const normalized = normalizeIdentity(identity);
  if (!normalized) return { ok: false, msg: 'Informe um número, JID, menção ou responda à pessoa.' };

  const data = getAutomationData();
  if (data.additionalOwners.some(owner => identitiesMatch(owner, normalized))) {
    return { ok: false, msg: 'Essa pessoa já está cadastrada como dona.' };
  }

  data.additionalOwners.push(normalized);
  saveAutomationData(data);
  return { ok: true, identity: normalized };
}

export function removeAdditionalOwner(identity) {
  const normalized = normalizeIdentity(identity);
  const data = getAutomationData();
  const before = data.additionalOwners.length;
  data.additionalOwners = data.additionalOwners.filter(owner => !identitiesMatch(owner, normalized));
  if (data.additionalOwners.length === before) {
    return { ok: false, msg: 'Essa pessoa não está cadastrada como dona adicional.' };
  }
  saveAutomationData(data);
  return { ok: true, identity: normalized };
}

export function listAdditionalOwners() {
  return [...getAutomationData().additionalOwners];
}

function normalizePromptKey(value) {
  const key = String(value || 'gyomei').trim().toLowerCase();
  if (key === 'gyomei' || key === 'nazuna') return 'nazuna';
  if (key === 'humana' || key === 'ia') return key;
  return null;
}

export function setAssistantPrompt(personality, prompt) {
  const key = normalizePromptKey(personality);
  if (!key) return { ok: false, msg: 'Personalidade inválida. Use gyomei, humana ou ia.' };

  const text = String(prompt || '').trim();
  if (!text) return { ok: false, msg: 'O prompt não pode ficar vazio.' };
  if (text.length > MAX_PROMPT_LENGTH) {
    return { ok: false, msg: `O prompt pode ter no máximo ${MAX_PROMPT_LENGTH} caracteres.` };
  }

  const data = getAutomationData();
  data.assistantPrompts[key] = text;
  saveAutomationData(data);
  return { ok: true, key, length: text.length };
}

export function resetAssistantPrompt(personality) {
  const key = normalizePromptKey(personality);
  if (!key) return { ok: false, msg: 'Personalidade inválida. Use gyomei, humana ou ia.' };
  const data = getAutomationData();
  const existed = Boolean(data.assistantPrompts[key]);
  delete data.assistantPrompts[key];
  saveAutomationData(data);
  return { ok: true, key, existed };
}

export function getAssistantPrompt(personality) {
  const key = normalizePromptKey(personality);
  if (!key) return { ok: false, msg: 'Personalidade inválida. Use gyomei, humana ou ia.' };
  const custom = getAutomationData().assistantPrompts[key];
  return {
    ok: true,
    key,
    custom: typeof custom === 'string' && custom.trim().length > 0,
    prompt: typeof custom === 'string' ? custom : ''
  };
}

export function buildAssistantSystemPrompt(personality, legacyPrompt) {
  if (personality === 'pro') return legacyPrompt;

  const key = normalizePromptKey(personality) || 'nazuna';
  const custom = getAutomationData().assistantPrompts[key];
  const ownerInstructions = typeof custom === 'string' && custom.trim()
    ? `ORIENTAÇÕES PERSONALIZADAS DOS DONOS\n${custom.trim()}`
    : '';

  if (key === 'nazuna') {
    return [GYOMEI_PERSONALITY, ownerInstructions, RESPONSE_CONTRACT]
      .filter(Boolean)
      .join('\n\n');
  }

  return [legacyPrompt, GROUP_DISCIPLINE, ownerInstructions, RESPONSE_CONTRACT]
    .filter(Boolean)
    .join('\n\n');
}
