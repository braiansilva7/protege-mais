# PROT-NNN

## Título

Título orientado a um único resultado verificável.

| Campo        | Valor                     |
| ------------ | ------------------------- |
| Status       | Pendente                  |
| Tipo         | Story ou Technical Story  |
| Prioridade   | P0, P1 ou P2              |
| Fase         | Número e nome             |
| Dependências | IDs concluídos ou nenhuma |

## Objetivo

Resultado e motivo.

## Escopo

- artefatos e comportamentos incluídos;
- camadas afetadas;
- contratos e dados afetados.

## Fora do escopo

- comportamentos adiados explicitamente.

## Regras e riscos

- invariantes de negócio;
- segurança, privacidade, concorrência e falhas.

## Critérios de aceite

1. Given/When/Then observável.
2. Cenário negativo ou de acesso.
3. Cenário de falha/degradação quando aplicável.

## Plano mínimo de testes

- unitários;
- integração;
- contrato/HTTP;
- autorização e escopo;
- build/typecheck/lint.

## Documentação obrigatória

- documentos que precisam refletir o resultado;
- entrada no changelog;
- ADR, se necessário.
