# ADR-007 — Identidade, endereço e posição de unidades organizacionais

Status: Aceito
Data: 2026-08-30
Ticket: PROT-020

## Contexto

Uma unidade precisa ser identificada dentro da organização, manter endereço
brasileiro consultável e participar de busca geodésica em metros. O ticket não
define uma taxonomia fechada de tipos de unidade nem autoriza liberar o código
após soft delete.

O PostGIS aceita `geography(Point,4326)`, mas entradas geográficas fora dos
limites podem ser normalizadas pelo cast. Persistir simultaneamente escalares e
um ponto gravável também permitiria divergência. Além disso, o Drizzle fixado no
projeto ainda exporta um tipo PostGIS customizado com aspas incompatíveis com o
typmod e o Atlas avalia o estado desejado em um banco descartável que pode ter a
extensão removida durante a limpeza.

## Decisão

- tornar `organization_id` obrigatório e tratar ownership como imutável na
  aplicação;
- manter `UNIQUE (organization_id, code)` global ao ciclo da linha, inclusive
  após soft delete;
- validar `type` como código técnico em `snake_case`, sem criar enum antes de o
  domínio aprovar os labels;
- persistir endereço em componentes obrigatórios, com complemento opcional, CEP
  canônico, UF e município IBGE coerentes;
- persistir longitude e latitude validadas e derivar delas uma coluna gerada
  `geography(Point,4326)`, sem permitir escrita direta de `position`;
- criar GiST para proximidade e manter localização fora de logs e da projeção
  padrão;
- referenciar unidade no RBAC por FK composta com organização, impedindo pares
  contextuais divergentes;
- adaptar somente a fronteira de export Drizzle→Atlas: corrigir a renderização
  exata do typmod e garantir PostGIS no banco descartável antes da avaliação. A
  migration continua sendo a única forma de habilitar a extensão no deploy.

## Alternativas consideradas

- Usar somente `geography` gravável: rejeitado porque não rejeita de forma
  confiável toda coordenada de entrada fora da faixa e permite trocar a ordem
  dos eixos.
- Persistir ponto e escalares independentes: rejeitado porque cria duas fontes
  de verdade e exige check complexo de igualdade espacial.
- Usar `geometry(Point,4326)`: rejeitado porque a consulta exigida é de
  distância sobre a superfície terrestre e o contrato existente usa metros.
- Criar enum de tipo: rejeitado porque labels inventados congelariam uma regra
  de negócio ainda não aprovada.
- Liberar código após soft delete: rejeitado porque fragmentaria identidade,
  atribuições e histórico da mesma unidade.
- FK apenas para `organization_unit_id`: rejeitado porque permitiria combinar
  a organização A com uma unidade pertencente à organização B.
- Alterar ou atualizar Drizzle: rejeitado porque o ticket não autoriza upgrade;
  o adaptador pequeno preserva as versões fixadas e tem saída validada por
  Atlas.

## Consequências

Coordenadas inválidas falham antes da geração e toda posição persistida é um
Point SRID 4326 coerente com seus escalares. A busca `ST_DWithin` usa GiST e
`ST_Distance` retorna metros. O endereço permanece estruturado e protegido.

Código e ownership tornam-se identidades contextuais duráveis. Mudança de
organização ou reutilização de código exige decisão e migration compatível com
histórico e RBAC. Novos tipos continuam possíveis sem DDL, mas a aplicação deve
governar os códigos até existir catálogo aprovado.

O exportador executa `CREATE EXTENSION IF NOT EXISTS postgis` apenas em
`DB_ATLAS`, que é descartável, e nunca em `DB_DATABASE_URL`. Se a extensão não
puder ser preparada, o diff falha com mensagem segura. Produção continua
forward-only pela migration estrutural existente; remover o adaptador depende de
suporte nativo comprovado na versão futura do Drizzle.
