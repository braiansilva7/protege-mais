# Guia técnico de criação de rotas — Protege Mais

## OBJETIVO

Definir o procedimento obrigatório para criar ou alterar uma funcionalidade exposta por rota no backend e consumida no web do Protege Mais.

Este guia preserva a separação entre transporte HTTP, regra de negócio, persistência e interface. Ele também garante que permissões, Swagger, contratos e traduções sejam implementados de forma consistente.

## QUANDO USAR

Aplicar este guia ao criar ou alterar uma operação de:

- criação;
- listagem;
- consulta por identificador;
- atualização;
- exclusão;
- ação específica de um domínio.

Antes de criar arquivos, verificar o shell de saúde e as implementações concluídas registradas no changelog. Os fluxos removidos em `PROT-000` não são referência arquitetural e não devem ser recuperados por cópia do histórico.

## ARQUITETURA DO BACKEND

### RESPONSABILIDADE DAS PASTAS

- `apps/manager_api/src/routes`: declara método HTTP, URL, schema, handler e middleware.
- `apps/manager_api/src/controllers`: adapta `request` e `reply` do Fastify; não contém regra de negócio.
- `apps/manager_api/src/permissions`: agrupa permissões usadas pelo Manager API.
- `apps/manager_api/src/plugins/swagger`: configura Swagger.
- `packages/schema`: contratos de request e response do Fastify/Swagger.
- `packages/interfaces`: interfaces e tipos de entrada compartilhados.
- `packages/useCases`: regras de negócio por operação.
- `packages/services`: serviços reutilizáveis de domínio ou integração.
- `packages/repositories`: acesso a dados.
- `packages/models`: modelos e mapeamentos de persistência.

### HIERARQUIA OBRIGATÓRIA

```text
Rota → Controller → Use case → Repository/Service → Model/Banco
```

Não inverter essa direção. Em especial:

- controller não consulta banco;
- página web não chama URL diretamente;
- service não declara interfaces locais;
- regra de autorização não fica apenas no frontend.

## CRIAÇÃO DE UMA ROTA NO BACKEND

### 1. DEFINIR O CONTRATO

Definir antes de codificar:

- método HTTP;
- URL REST, usando recurso no plural;
- parâmetros de rota e query;
- body de entrada;
- formato de resposta;
- status HTTP;
- permissões exigidas;
- mensagens de erro.

Exemplos:

```text
POST   /victims
GET    /victims
PATCH  /victims/:id
DELETE /victims/:id
```

As rotas registradas em `apps/manager_api/src/routes/index.ts` recebem o prefixo `/api/v1` no `server.ts`. Não repetir esse prefixo no arquivo da rota.

### 2. CRIAR INTERFACES

Criar entradas em:

```text
packages/interfaces/<dominio>/I<Operacao>Input.ts
```

Exemplo:

```text
packages/interfaces/victim/ICreateVictimInput.ts
```

Nunca declarar interfaces diretamente em `packages/services` ou `packages/useCases`.

### 3. CRIAR OU AJUSTAR PERSISTÊNCIA

Quando houver dados persistidos:

- criar ou ajustar model em `packages/models/<dominio>`;
- criar migration correspondente;
- criar ou ajustar repositório em `packages/repositories/<dominio>`;
- manter regras de consulta e escrita no repositório.

Não expor campos internos, hashes de senha, tokens ou atributos exclusivos do banco na resposta pública.

### 4. CRIAR O USE CASE

Criar o caso de uso em:

```text
packages/useCases/<dominio>/<Operacao>.usecase.ts
```

O use case deve:

- receber a interface de entrada;
- executar validações de domínio;
- chamar repositórios e serviços;
- lançar ou devolver erros previstos pelo domínio;
- retornar somente os dados necessários ao controller.

Usar as dependências registradas com `tsyringe`. Não instanciar repositórios e serviços diretamente no controller.

### 5. CRIAR SCHEMAS E SWAGGER

Criar schemas por operação em:

```text
packages/schema/<dominio>/<operacao>/
├── index.ts
├── request.schema.ts
└── response.schema.ts
```

O schema deve declarar:

- `tags`;
- `summary`;
- parâmetros;
- query string;
- body;
- respostas de sucesso e erro.

Ele é usado tanto para validação do Fastify quanto para documentação em `/swagger/`.

### 6. CRIAR CONTROLLER

Criar o controller em:

```text
apps/manager_api/src/controllers/<dominio>/
```

O controller deve:

- obter dados de `request.params`, `request.query` ou `request.body`;
- resolver o use case pelo container;
- chamar o use case;
- devolver o status e o body HTTP.

Não incluir SQL, regra de negócio extensa ou textos literais no controller.

### 7. DEFINIR PERMISSÃO E REGISTRAR ROTA

Criar ou ajustar permissões em:

```text
apps/manager_api/src/permissions/
```

Registrar a rota em:

```text
apps/manager_api/src/routes/<dominio>.route.ts
```

Modelo:

```ts
server.post('/victims', {
  schema: createVictimSchema,
  handler: victimController.createVictim,
  preHandler: [
    (request, reply) =>
      server.authenticateJwt(request, reply, victimCreatePermissions),
  ],
});
```

Por fim, registrar o arquivo no agregador:

```text
apps/manager_api/src/routes/index.ts
```

## TRADUÇÕES DO BACKEND

Toda mensagem retornada pela API deve ter chave nos três arquivos:

```text
packages/plugins/i18next/locales/pt-BR/translation.json
packages/plugins/i18next/locales/en/translation.json
packages/plugins/i18next/locales/es/translation.json
```

Criar a mesma chave nos três idiomas para:

- sucesso;
- validação;
- recurso não encontrado;
- ausência de permissão;
- conflito;
- erro de conexão ou falha inesperada.

O idioma é enviado pelo cabeçalho `Accept-Language`, com `pt-BR` como
fallback. Erros de domínio devem informar uma `messageKey` existente nos três
catálogos. Não retornar mensagens em português diretamente no controller ou
use case. A convenção completa está em
`docs/api/INTERNATIONALIZATION.md`.

## ARQUITETURA DO FRONT-END

### RESPONSABILIDADE DAS PASTAS

- `apps/web/src/types`: contratos TypeScript do recurso e da API.
- `apps/web/src/composables`: chamadas HTTP, estado de carregamento e erros.
- `apps/web/src/pages`: telas de negócio.
- `apps/web/src/components/<dominio>`: formulários, tabelas, diálogos e blocos reutilizáveis.
- `apps/web/src/layouts`: estrutura compartilhada da área autenticada.
- `apps/web/src/navigation/vertical`: itens do menu vertical.
- `apps/web/src/navigation/horizontal`: itens do menu horizontal.
- `apps/web/src/utils`: funções puras, como formatadores e conversão de locale.
- `apps/web/src/plugins/i18n`: configuração e arquivos de tradução.

### 1. CRIAR TIPOS E COMPOSABLE

Criar os contratos em:

```text
apps/web/src/types/<dominio>.ts
```

Concentrar acesso HTTP no composable:

```text
apps/web/src/composables/use<Domain>.ts
```

O composable deve:

- usar `VITE_API_URL`;
- enviar `Authorization: Bearer <token>` em rotas protegidas;
- enviar `Accept-Language` com o locale atual;
- controlar carregamento;
- separar erro de negócio de erro de conexão;
- devolver dados tipados.

Não colocar URL base, token, `fetch` ou parsing de resposta diretamente em páginas e componentes.

### 2. CRIAR PÁGINA E COMPONENTES

Criar a página:

```text
apps/web/src/pages/<Recurso>Page.vue
```

Extrair componentes específicos para:

```text
apps/web/src/components/<dominio>/
```

Exemplos de componentes:

- formulário;
- diálogo de confirmação;
- tabela;
- filtro;
- card de resumo.

Página coordena o fluxo; componente recebe props e emite eventos; composable conversa com API.

### 3. REGISTRAR NAVEGAÇÃO

Adicionar o recurso nos dois arquivos:

```text
apps/web/src/navigation/vertical/index.ts
apps/web/src/navigation/horizontal/index.ts
```

Cada item deve informar:

- página/destino;
- chave de tradução do título;
- ícone;
- papéis autorizados, quando necessário.

Ocultar um item no menu não substitui autorização no backend.

## TRADUÇÕES DO FRONT-END

Adicionar a mesma chave em:

```text
apps/web/src/plugins/i18n/locales/pt.json
apps/web/src/plugins/i18n/locales/en.json
apps/web/src/plugins/i18n/locales/es.json
```

Traduzir:

- título da página;
- labels;
- placeholders;
- ações;
- estados vazios;
- carregamento;
- mensagens de erro;
- confirmações de exclusão;
- textos de navegação.

Usar `$t('chave')` no template ou `t('chave')` no script. Não deixar texto exibido ao usuário literal no componente.

ATENÇÃO: no `vue-i18n`, o caractere `@` possui significado especial. Para mostrar um e-mail de exemplo, utilizar o padrão compatível já aplicado no projeto:

```text
email{'@'}email.com
```

## VALIDAÇÃO OBRIGATÓRIA

Antes de concluir:

1. Executar migration, quando houver alteração de banco.
2. Testar rota autenticada, sem autenticação e sem permissão.
3. Conferir request, response e erros em `/swagger/`.
4. Testar o fluxo no web: carregamento, lista vazia, erro, criação, edição e exclusão.
5. Confirmar chaves nos seis arquivos de tradução: três do backend e três do web.
6. Executar:

```bash
pnpm --filter @protege-mais/web typecheck
pnpm --filter @protege-mais/web build
```

## CHECKLIST FINAL

- [ ] Interface criada em `packages/interfaces`.
- [ ] Schema criado em `packages/schema`.
- [ ] Use case criado em `packages/useCases`.
- [ ] Controller criado em `apps/manager_api/src/controllers`.
- [ ] Permissão criada em `apps/manager_api/src/permissions`.
- [ ] Rota registrada no arquivo de domínio e em `routes/index.ts`.
- [ ] Swagger validado.
- [ ] Web separado entre `types`, `composables`, `pages`, `components` e `navigation`.
- [ ] Navegação vertical e horizontal atualizadas.
- [ ] Traduções completas em português, inglês e espanhol no backend e web.
- [ ] Typecheck e build executados.

---

Documentação Protege Mais — Guia técnico de criação de rotas
