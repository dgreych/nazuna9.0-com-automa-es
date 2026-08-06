# Automações da NAZUNA BOT - versão modificada GYOMEI

Este documento descreve as alterações aplicadas sobre a base **Nazuna 9.0**.

GYOMEI identifica a versão modificada e a personalidade principal da IA. A base do projeto continua sendo o NAZUNA BOT, com os créditos originais preservados.

## Estratégia de compatibilidade

A maior parte dos arquivos legados permanece reconhecível. Durante a inicialização, o projeto gera arquivos `.runtime-*.js` e aplica neles as adaptações necessárias.

```bash
npm start
```

Arquivos gerados:

```text
dados/src/.runtime-index.js
dados/src/.runtime-connect.js
dados/src/funcs/private/.runtime-ia.js
dados/src/menus/.runtime-index.js
dados/src/menus/.runtime-menubn.js
dados/src/.scripts/.runtime-start.js
```

Eles são recriados a cada inicialização e ignorados pelo Git.

## IA e personalidade GYOMEI

O prompt protegido orienta a IA a:

- assumir o nome GYOMEI;
- reconhecer que pertence à versão modificada do NAZUNA BOT;
- responder somente quando mencionada ou quando alguém responde ao bot;
- permanecer no assunto atual;
- não oferecer ajuda aleatória;
- conversar naturalmente em grupos;
- evitar fatos e ações inventados;
- manter respostas adequadas ao WhatsApp;
- produzir o JSON exigido pelo processador legado.

O modelo de execução é:

```text
meta/llama-3.1-8b-instruct
```

A credencial NVIDIA é obtida de `.env.local`, do ambiente ou de `nvidia_api_key` em `config.json`. O runtime não mantém uma chave hardcoded.

### Prompts adicionais

```text
!prompts
!verprompt gyomei
!setprompt gyomei texto
!resetprompt gyomei
```

Também é possível responder a uma mensagem com `!setprompt gyomei`.

## Donos adicionais

Somente o dono principal configurado no bot pode executar:

```text
!adddono número
!deldono número
```

O alvo pode ser informado por número, JID, menção ou mensagem respondida.

```text
!listdonos
```

Os dados ficam em:

```text
dados/database/dono/automacoes-v9.json
```

## Transcrição

A detecção de áudio:

- desembrulha mensagens efêmeras e view-once;
- aceita `audioMessage` com ou sem `ptt: true`;
- aceita `documentMessage` com MIME `audio/*`;
- usa o mesmo extrator no comando manual e no modo automático.

Comandos:

```text
!t
!transc
!transcrever
!autotr
!autotransc
```

A versão atual usa Vex para transcrição depois que o áudio recebe um link temporário. A futura migração Nodz será feita somente após validação do contrato da API.

## Mensagens apagadas

O rastreador observa:

- `messages.delete`;
- `messages.update` com `protocolMessage`;
- revogações recebidas em `messages.upsert`.

Comandos:

```text
!return1
!return2
!return3
!return4
!return5
!return 1
```

São suportados texto, imagem, vídeo, áudio, figurinha e documento.

O banco persistido usa um reviver de `Buffer`, preservando campos binários necessários para recuperar mídias depois de uma reinicialização.

## Mídias personalizadas

```text
!menumidia
!setmidia menu
!setmidia menubn
!setmidia comando
!delmidia comando
```

O `setmidia` usa um downloader próprio para a mídia citada. Ele não depende das variáveis legadas `foto1` ou `video1`.

As mídias ficam em:

```text
dados/database/dono/command-media/
```

O interceptador pode substituir respostas que já possuem mídia e também respostas somente em texto. Nesse segundo caso, o texto vira legenda da mídia configurada.

## Sugestão de comandos

Quando um comando não existe, o runtime mostra:

- o comando digitado;
- até três sugestões ordenadas;
- percentual de similaridade discreto;
- orientação para abrir o menu quando não há sugestão segura.

A identidade exibida no cartão é **NAZUNA BOT • GYOMEI**.

## Créditos no comando `criador`

A saída separa três responsabilidades:

1. **Hiudy (Hiduy)** pela criação original;
2. **DevTokyo** pela continuidade da Nazuna e pelo projeto original atual;
3. **Alaska_dev** pelos aprimoramentos da versão modificada GYOMEI.

Contatos e repositórios são mantidos no próprio output do comando.

## Arquivos principais da camada adicionada

```text
dados/src/utils/gyomeiStore.js
dados/src/utils/gyomeiCore.js
dados/src/utils/gyomeiMedia.js
dados/src/utils/gyomeiOperations.js
dados/src/utils/gyomeiRuntime.js
```

## Validação

```bash
npm run validate:ci
npm run validate:local
npm run validate:deploy
npm run validate:public
```

As validações confirmam, entre outros pontos:

- geração e sintaxe dos runtimes;
- identidade correta do projeto;
- créditos e contatos preservados;
- presença dos comandos adicionados;
- downloader independente do `setmidia`;
- restauração de buffers do `return`;
- externalização da chave NVIDIA;
- isolamento da build de servidor.

## Direção futura: Nodz

A meta é criar uma camada de provedores e migrar downloads e funcionalidades externas progressivamente para a API Nodz.

A sequência planejada é:

1. documentar autenticação, limites e contratos da Nodz;
2. criar cliente centralizado com timeout e erros padronizados;
3. adicionar adaptadores por categoria de comando;
4. migrar um comando por vez com testes;
5. manter fallback durante a transição;
6. remover integrações antigas somente depois da validação em produção.

Detalhes em [ROADMAP_NODZ.md](ROADMAP_NODZ.md).
