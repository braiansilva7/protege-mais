# Processo de documentação da implementação

## Antes de codificar

1. Marcar o ticket como `Em andamento` no índice e no arquivo do épico.
2. Confirmar que as dependências estão `Concluídas`.
3. Ler arquitetura, segurança e ADRs aplicáveis.
4. Registrar dúvidas que alterem escopo; não assumir política jurídica ou de
   segurança ausente.

## Durante a implementação

- Atualizar contrato, migration e documentação junto com o código.
- Criar ADR quando houver decisão estrutural ou alternativa relevante.
- Manter uma lista dos arquivos alterados e dos comandos de validação.
- Não marcar critério como atendido sem evidência reproduzível.

## Ao concluir

Adicionar uma entrada em `CHANGELOG.md` usando este formato:

```md
## AAAA-MM-DD — PROT-NNN — Título

Status: Concluído

### Resultado

Resumo do comportamento entregue.

### Arquivos e dados

- código/configuração alterados;
- migrations e impacto em dados;
- endpoints, permissões e eventos;
- documentação atualizada.

### Validação

- `comando`: resultado;
- cenários manuais/automatizados: resultado.

### Decisões e pendências

- ADR relacionado ou `Nenhum`;
- pendências deliberadamente fora do escopo ou `Nenhuma`.
```

Depois, marcar o ticket como `Concluído` nos dois lugares. Se houver bloqueio,
registrar causa e condição objetiva para retomada.

## Documentos que podem precisar de atualização

- `docs/PROJECT_ARCHITECTURE.md`: estado real do código;
- `docs/architecture/TARGET_ARCHITECTURE.md`: apenas mudança aprovada do alvo;
- `docs/architecture/SECURITY_AND_PRIVACY.md`: novas regras normativas;
- `docs/database/`: schema, índices, retenção e diagrama;
- `docs/api/`: contratos e exemplos sem dados reais;
- `docs/permissions/`: catálogo e matriz de acesso;
- `docs/product/ROADMAP.md`: dependências e marcos;
- `docs/decisions/`: ADRs.
