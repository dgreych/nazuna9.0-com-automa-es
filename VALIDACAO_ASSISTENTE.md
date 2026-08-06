# Validação real da assistente NVIDIA

Este teste verifica a integração da assistente pela arquitetura da própria Nazuna 9.0 modificada. Ele não faz uma chamada isolada por `curl` e não grava a chave no código.

O fluxo validado é:

1. carregar `.env.local`;
2. gerar as fontes `.runtime-*`;
3. aplicar o modelo `meta/llama-3.1-8b-instruct`;
4. montar o prompt protegido do GYOMEI;
5. importar `makeCognimaRequest` do módulo runtime;
6. chamar `https://integrate.api.nvidia.com/v1/chat/completions`;
7. validar `choices[0].message.content`;
8. exigir JSON compatível com o processador da Nazuna;
9. confirmar que a assistente assume o nome GYOMEI;
10. rejeitar ofertas genéricas de ajuda em conversa casual.

## 1. Configurar a chave temporária

Na raiz do projeto:

```bash
cp -n .env.example .env.local
chmod 600 .env.local
nano .env.local
```

Preencha sem aspas:

```text
NVIDIA_API_KEY=SUA_CHAVE_TEMPORARIA
VEX_API_KEY=SUA_CHAVE_VEX
VEX_SITE=https://vexapi.com.br
```

Nunca envie `.env.local` ao GitHub, a um grupo ou a um artefato público.

## 2. Sincronizar e validar a estrutura

```bash
git fetch origin
git switch feat/automacoes-v9
git pull --ff-only
npm run validate:local
```

## 3. Executar a chamada real

```bash
npm run validate:nvidia
```

O teste só é aprovado quando imprime:

```text
Fluxo NVIDIA + prompt + resposta da assistente aprovado.
```

Ele também mostra o modelo retornado, a latência e uma prévia da resposta, mas nunca mostra a chave.

## 4. Validar tudo antes do deploy

```bash
npm run validate:deploy:online
```

Esse comando executa primeiro as validações locais/deploy e depois a chamada autenticada da assistente.

## 5. Gerar a build privada

```bash
npm run build:server
```

A build privada agora chama `validate:nvidia` antes de empacotar. Se a chave estiver inválida, o modelo estiver indisponível, a resposta não for JSON ou a personalidade não assumir GYOMEI, a build não será criada.

## 6. Teste no WhatsApp

Depois da validação automatizada:

1. inicie com `npm start`;
2. mencione o bot e pergunte o nome;
3. confirme que responde como GYOMEI;
4. responda a uma mensagem dele com uma frase curta;
5. confirme que mantém o assunto;
6. escreva uma frase casual e verifique que ele não encerra com “em que posso ajudar?”.

## 7. Encerrar o uso da chave temporária

Depois do teste e do deploy:

1. revogue a chave temporária no painel da NVIDIA;
2. gere uma chave definitiva para o servidor;
3. substitua apenas o valor de `NVIDIA_API_KEY` no `.env.local` do servidor;
4. execute novamente `npm run validate:nvidia`;
5. reinicie o serviço.

A chave nunca deve voltar para `ia.js`, `config.json` público, workflow ou histórico Git.
