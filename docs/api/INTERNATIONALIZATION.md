# Internacionalização do backend

## Idiomas e fallback

A Manager API oferece mensagens públicas em `pt-BR`, `en` e `es`. O locale
padrão e o fallback são sempre `pt-BR`; locale ausente, malformado ou não
suportado não interrompe a requisição.

O cabeçalho `Accept-Language` é resolvido por peso `q` e ordem de preferência.
Variantes regionais usam o idioma base disponível:

| Entrada de exemplo                   | Locale resolvido |
| ------------------------------------ | ---------------- |
| ausente                              | `pt-BR`          |
| `pt`, `pt-BR` ou `pt-PT`             | `pt-BR`          |
| `en` ou `en-US`                      | `en`             |
| `es` ou `es-AR`                      | `es`             |
| `es;q=0.5, en-US;q=0.9`              | `en`             |
| `fr-FR` ou outro idioma indisponível | `pt-BR`          |

Preferências com `q=0` não são aceitas. O curinga `*` seleciona o fallback
quando for a preferência aplicável.

Toda resposta processada pelo plugin informa o locale efetivo em
`Content-Language` e inclui `Accept-Language` em `Vary`, evitando que caches
reutilizem uma mensagem no idioma incorreto.

## Catálogos

Os catálogos backend ficam em:

```text
packages/plugins/i18next/locales/pt-BR/translation.json
packages/plugins/i18next/locales/en/translation.json
packages/plugins/i18next/locales/es/translation.json
```

As chaves usam grupos semânticos separados por ponto e segmentos em
`camelCase`, por exemplo:

```text
errors.validation
health.ok
health.notReady
authentication.invalidCredentials
victims.errors.notFound
```

Não usar a frase traduzida como chave e não incluir status HTTP, identificador,
PII ou valor recebido na chave. Uma nova mensagem visível deve ser adicionada
aos três catálogos no mesmo commit. A suíte do package `plugins` compara
automaticamente todas as chaves e rejeita catálogos divergentes ou textos
vazios.

## Erros traduzíveis

As classes de erro comuns possuem `messageKey` para os defaults. O handler
traduz somente `message`; `code`, status HTTP e `requestId` não dependem do
idioma.

Uma mensagem de domínio deve referenciar uma chave específica, sem texto
hardcoded no controller ou use case:

```ts
throw new NotFoundError({
  code: 'VICTIM_NOT_FOUND',
  messageKey: 'victims.errors.notFound',
});
```

Se uma chave específica não puder ser resolvida, a mensagem pública segura da
classe permanece como fallback. O código estável continua sendo a referência
para clientes, métricas e tratamento programático; clientes não devem comparar
o texto traduzido.

## Chaves comuns atuais

- `errors.*`: aplicação, validação, acesso negado, recurso ausente, conflito,
  regra de negócio, infraestrutura, indisponibilidade, falha interna e erro
  genérico de request;
- `health.ok`: processo operacional;
- `health.notReady`: processo indisponível para receber tráfego;
- `authentication.required`, `authentication.invalidCredentials`,
  `authentication.invalidAccessToken`, `authentication.invalidRefreshToken`,
  `authentication.rateLimited` e `authentication.unavailable`: mensagens
  públicas de autenticação;
- `errors.tooManyRequests`: default comum para falhas HTTP 429.

Login e refresh usam as chaves específicas sem variar mensagem por existência
ou estado da conta/sessão. `code` e status permanecem iguais nos três idiomas.
