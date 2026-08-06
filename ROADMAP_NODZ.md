# Roadmap de integração com a API Nodz

## Objetivo

Fazer com que downloads e outras funcionalidades externas da **NAZUNA BOT - versão modificada GYOMEI** dependam progressivamente de uma integração central com a API Nodz.

A migração deve reduzir código duplicado, padronizar erros e facilitar manutenção, sem remover comandos funcionais antes de existir uma substituição validada.

## Estado atual

A versão modificada `1.0.0` ainda utiliza integrações herdadas da Nazuna 9.0 e serviços específicos, incluindo Vex para transcrição.

Não existe nesta branch um cliente Nodz centralizado nem contratos confirmados para substituir todas essas funções.

## Informações necessárias antes da implementação

- URL base oficial;
- formato de autenticação;
- limites de requisição;
- política de timeout e filas;
- endpoints disponíveis;
- parâmetros obrigatórios;
- formatos de sucesso e erro;
- limites de tamanho e duração de mídia;
- política de armazenamento temporário;
- termos de uso e disponibilidade.

## Arquitetura planejada

```text
dados/src/services/nodz/
  client.js
  errors.js
  providers/
    downloads.js
    media.js
    transcription.js
    utilities.js
```

O cliente central deve oferecer:

- autenticação em um único ponto;
- timeout configurável;
- tratamento padronizado de erros;
- mensagens seguras para o usuário;
- logs sem exposição de chaves;
- retentativas somente quando forem seguras;
- validação do formato de resposta;
- métricas básicas sem dados pessoais.

## Ordem sugerida de migração

1. comandos de download com menor impacto;
2. utilidades de mídia;
3. buscas e consultas externas;
4. transcrição, caso a Nodz ofereça contrato estável equivalente;
5. demais integrações legadas.

## Estratégia por comando

Cada migração deve seguir estas etapas:

1. registrar o comportamento atual;
2. adicionar teste do parser e dos erros;
3. implementar o adaptador Nodz;
4. manter fallback temporário;
5. testar em grupo controlado;
6. observar falhas e limites;
7. remover o fallback somente após estabilidade comprovada.

## Regras de segurança

- chaves somente em `.env.local` ou variáveis do servidor;
- nunca imprimir tokens em logs;
- não versionar respostas com dados pessoais;
- validar URLs retornadas antes do download;
- limitar tamanho, duração e tempo de processamento;
- recusar MIME inesperado;
- não reenviar conteúdo privado a serviços sem necessidade funcional.

## Critério de conclusão

A dependência exclusiva da API Nodz só será considerada concluída quando:

- todos os comandos definidos no escopo tiverem adaptadores Nodz;
- os contratos estiverem documentados;
- os testes locais e de CI passarem;
- o teste de fumaça no WhatsApp estiver aprovado;
- não houver regressão funcional relevante;
- as integrações antigas puderem ser removidas sem quebrar comandos.
