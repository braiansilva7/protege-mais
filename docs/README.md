# Documentação do Protege Mais

Este diretório é a fonte de verdade do produto, da arquitetura e da execução do
Protege Mais. A arquitetura-alvo descreve o destino; os tickets descrevem os
incrementos; o registro de implementação descreve somente o que já existe no
código.

## Por onde começar

1. Leia o [roadmap do produto](product/ROADMAP.md).
2. Leia a [arquitetura-alvo](architecture/TARGET_ARCHITECTURE.md) e os
   [requisitos de segurança e privacidade](architecture/SECURITY_AND_PRIVACY.md).
3. Consulte o [índice dos tickets](tickets/README.md) e execute apenas o
   primeiro ticket pendente cujas dependências estejam concluídas.
4. Durante a implementação, siga o
   [processo de documentação](implementation/README.md).
5. Registre decisões estruturais em [decisions](decisions/README.md).

## Como solicitar uma etapa

Use o identificador do ticket sem agrupar etapas independentes. Exemplo:

```text
Implemente o ticket PROT-003 seguindo toda a documentação do projeto.
```

Antes de iniciar, o executor deve reler o ticket, suas dependências e os
documentos de arquitetura aplicáveis. Ao terminar, deve atualizar o status do
ticket e o registro de implementação com arquivos alterados, migrations,
testes, decisões e pendências.

## Fontes de verdade

| Assunto                                  | Documento                                            |
| ---------------------------------------- | ---------------------------------------------------- |
| Sequência, fases e marcos                | `docs/product/ROADMAP.md`                            |
| Arquitetura futura aprovada              | `docs/architecture/TARGET_ARCHITECTURE.md`           |
| Segurança, privacidade e dados sensíveis | `docs/architecture/SECURITY_AND_PRIVACY.md`          |
| Estado atual do código                   | `docs/PROJECT_ARCHITECTURE.md`                       |
| Runtime e convenções de qualidade        | `docs/QUALITY.md`                                    |
| Tickets e seus estados                   | `docs/tickets/README.md` e arquivos de épico         |
| Mudanças efetivamente implementadas      | `docs/implementation/CHANGELOG.md`                   |
| Auditoria de dependências de 2026-08-23  | `docs/implementation/DEPENDENCY_AUDIT_2026-08-23.md` |
| Decisões com impacto arquitetural        | `docs/decisions/`                                    |
| Padrão para rotas verticais              | `docs/ROUTE_CREATION_GUIDE.md`                       |

## Regra contra divergência documental

Um ticket não está concluído quando apenas o código funciona. Ele só pode ser
marcado como concluído quando:

- os critérios de aceite foram comprovados;
- os testes previstos foram executados;
- o registro de implementação foi preenchido;
- os documentos afetados foram atualizados;
- novas decisões arquiteturais possuem ADR;
- migrations, contratos e permissões estão sincronizados com o código.

Documentos nunca devem declarar uma funcionalidade como disponível antes de
sua implementação e validação.
