# Auditoria de dependências — 2026-08-23

## Contexto

Esta é uma fotografia adicional tirada ao concluir o `PROT-002`. O ticket
adicionou ferramentas de qualidade, mas não autoriza atualizar as bibliotecas de
runtime existentes. O baseline continua sem funcionalidade de negócio e não
deve ser tratado como pronto para produção.

## Resultado

| Comando                                | Resultado                      |
| -------------------------------------- | ------------------------------ |
| `pnpm audit --audit-level high`        | 14 achados: 10 altos, 4 médios |
| `pnpm audit --prod --audit-level high` | 13 achados: 10 altos, 3 médios |

Os achados altos atingem estes grupos:

- `drizzle-orm`: escape incorreto de identificadores SQL;
- `@fastify/static`, via Swagger UI: bypass de proteção de rota;
- `fast-uri`, via Fastify, AJV e Swagger;
- `brace-expansion`, usado por glob/minimatch em ferramentas;
- `js-yaml`, `image-size` e `nanoid`, presentes nos grafos de Expo, Metro ou
  Vue.

O resultado de `--prod` segue a classificação do pnpm. Algumas ferramentas de
build são dependências do Expo e, por isso, também aparecem nesse grafo.

## Tratamento

Nenhuma versão existente ou dependência transitiva foi forçada neste ticket.
Corrigir os achados exige atualizar dependências diretas, testar overrides
transitivos ou aguardar releases compatíveis, o que precisa de escopo e
validação próprios.

Antes de qualquer implantação, deve existir um ticket dedicado que:

1. atualize os pacotes afetados com revisão de breaking changes;
2. execute testes de API, Swagger, banco, Web e Mobile;
3. repita as duas auditorias e registre os riscos que eventualmente permanecerem.

Os detalhes reproduzíveis e os links de cada advisory são exibidos pelos dois
comandos acima.
