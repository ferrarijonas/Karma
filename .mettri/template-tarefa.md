# Template de Tarefa

Antes de adicionar qualquer tarefa no TAREFAS.md, garantir que contenha:

1. **O que já existe?** — arquivos, scripts, configs relacionados (ex: `eslint.config.js`, `scripts/inspect-*.mjs`)
2. **Onde verificar/input?** — arquivos/diretórios que a tarefa vai usar (ex: `src/modules/*`, `docs/specs/`)
3. **O que produzir/output?** — arquivo novo, relatório, alteração (ex: script, INDICE.md, relatório)
4. **Onde salvar?** — pasta específica (ex: `scripts/`, `docs/`, `.mettri/`)
5. **Como validar?** — como testar o resultado (ex: rodar script, verificar output)

Se qualquer campo estiver vazio → não adicionar a tarefa ainda. Primeiro pesquisar.

## Integração com TAREFAS.md

Ao criar SPEC.md em `.mettri/tarefas/pendentes/{id}/`, **atualizar TAREFAS.md na mesma operação**:
1. Adicionar item na lista correspondiente (ex: `- [ ] \`T-004\` descricao`)
2. Incrementar contador do bloco (ex: `(7)` → `(8)`)

Não esperar rodadas adicionais. Criar SPEC + atualizar quadro = uma coisa só.

## Regras

- **Jamais apagar tarefas do TAREFAS.md.** O histórico é sagrado.
- Tarefas concluídas → marcar com `[x]` (não apagar)
- Tarefas canceladas → marcar com `[~]` e justificar por que cancelou
- Apenas a tarefa que estou executando pode ser removida (quando aprovada/concluída)
