# Roadmap incremental do Protege Mais

## Objetivo

Entregar o Protege Mais em etapas pequenas e verificáveis, priorizando a
fundação de segurança e consistência antes de telas e fluxos críticos. O Web é
homologado antes do início funcional do Mobile.

## Princípios de sequenciamento

- Um ticket só começa com todas as dependências concluídas.
- Cada ticket deve deixar o repositório executável e testável.
- Migração de estrutura não depende de seed.
- Segurança e autorização são validadas no backend.
- Operações de emergência persistem rapidamente e delegam efeitos externos ao
  worker.
- O Mobile permanece estrutural até o marco Web homologado.

## Fases e tickets

| Fase                         | Resultado esperado                                            | Tickets                         |
| ---------------------------- | ------------------------------------------------------------- | ------------------------------- |
| 0 — Saneamento e arquitetura | Legado identificado, monorepo e padrões-base preparados       | PROT-000 a PROT-010             |
| 1 — Banco base               | Persistência, PostGIS, convenções e identidade organizacional | PROT-011 a PROT-021             |
| 2 — Autenticação             | Login, tokens, sessões, recuperação e MFA                     | PROT-022 a PROT-029             |
| 3 — Autorização contextual   | Permissão, escopos, auditoria e break glass                   | PROT-030 a PROT-034             |
| 4 — Vítimas                  | Perfil, dispositivos, modo discreto e contatos                | PROT-035 a PROT-038             |
| 5 — Casos e agressores       | Casos, pessoas agressoras e vínculos                          | PROT-039 a PROT-041             |
| 6 — Ocorrências              | Histórico de incidentes                                       | PROT-042                        |
| 7 — Medidas protetivas       | Medidas e seus termos                                         | PROT-043 e PROT-044             |
| 8 — Evidências               | Metadados, upload, consulta e acesso seguro                   | PROT-045                        |
| 9 — Central de emergência    | Alerta, destinatários e histórico imutável                    | PROT-046 a PROT-048             |
| 10 — Localização             | Sessões e pontos geoespaciais                                 | PROT-049 e PROT-050             |
| 11 — Rede de apoio           | Evolução dos contatos e acionamentos                          | Grooming após PROT-050          |
| 12 — Avaliação de risco      | Questionário, cálculo, revisão e histórico                    | Grooming após PROT-050          |
| 13 — Plano de segurança      | Plano individual e acompanhamento                             | Grooming após PROT-050          |
| 14 — Encaminhamentos         | Rede de serviços e acompanhamento                             | Grooming após PROT-050          |
| 15 — Notificações            | Preferências, templates e entrega assíncrona                  | Grooming após PROT-050          |
| 16 — Integrações             | Adaptadores institucionais resilientes                        | Grooming após PROT-050          |
| 17 — Dashboard e relatórios  | Operação, métricas e exportações autorizadas                  | Grooming após PROT-050          |
| 18 — Auditoria e LGPD        | Consulta, retenção e direitos do titular                      | Grooming após PROT-050          |
| 19 — Homologação Web         | Fluxos ponta a ponta, segurança e acessibilidade              | Grooming após PROT-050          |
| 20 — Web finalizado          | Gate formal antes do Mobile funcional                         | Marco sem implementação própria |
| 21+ — Mobile                 | Fluxos da vítima, emergência e localização                    | Iniciar somente após o gate Web |

As fases ainda marcadas como grooming não devem ser implementadas a partir de
uma descrição genérica. Antes disso, devem receber tickets com o mesmo nível de
detalhe, segurança e testabilidade de `PROT-000` a `PROT-050`.

## Marcos de liberação

### Marco A — Fundação executável

Requer `PROT-000` a `PROT-010`. API, Web e Worker iniciam; configuração,
erros, i18n, logs, Redis e filas possuem testes básicos.

### Marco B — Fundação de dados

Requer `PROT-011` a `PROT-021`. O banco pode ser criado do zero por migrations,
consultado e destruído/recriado sem procedimentos manuais ocultos.

### Marco C — Acesso institucional seguro

Requer `PROT-022` a `PROT-034`. Autenticação, autorização contextual,
revogação, auditoria e acesso excepcional estão testados.

### Marco D — Núcleo de proteção

Requer `PROT-035` a `PROT-045`. Os registros de vítima, caso, agressor,
ocorrência, medida e evidência funcionam com isolamento organizacional.

### Marco E — Emergência e localização

Requer `PROT-046` a `PROT-050`, testes de idempotência, degradação de
integrações e garantia de histórico.

## Ordem imediata

`PROT-001` consolidou os workspaces, os packages compartilhados e o shell ocioso
do worker. O próximo trabalho de implementação deve começar por `PROT-002`, que
padronizará TypeScript, lint e formatter em todos os workspaces.
