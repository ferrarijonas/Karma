### Checkpoint 2026-07-07T00:00:00Z
heartbeat: 2026-07-07T00:00:00Z — gate: GREEN (com ressalva lint sistêmico) — tentativa: 1

### Ações
- Adicionado parâmetro `fraseBase?: string` em `buildAgenteRetomarMessages()` (`agente-retomar-prompt.ts`)
- Quando `fraseBase` fornecida, injetada no system prompt: "O usuário sugeriu este tom/base: {fraseBase}..."
- Adicionado parâmetro `fraseBase?: string` em `suggestRedacaoRetomar()` (`ai-suggestion.ts`) e repassado ao prompt builder
- Adicionado campo `agenticFraseBase` (string) na classe `RetomarPanel`
- Adicionado `<textarea>` com placeholder "Frase base (opcional)" em `renderAgenticDetailPanel()` antes do botão "Gerar textos"
- `runAgenticGenerateForChatIds()` lê `this.agenticFraseBase` e repassa a `suggestRedacaoRetomar()`
- Adicionado listener `input` no textarea em `setupAgenticListeners()` para sincronizar estado
- Anonimizados números de telefone de exemplo em JSDoc/placeholder (falso positivo check-cleanup)

### Resultado
- check-mocks: ✓ | check-cleanup: ✓ | lint: ⚠️ (753 erros pré-existentes, 0 nos diffs) | typecheck: ✓ | build: ✓ | test:unit: ✓ (282 pass)

### Aprendizados
- `check-cleanup` detecta padrões de telefone/email em strings de documentação (ex: `5511999999999@c.us`). Usar texto descritivo evita falsos positivos.
- O projeto tem 753 erros de lint acumulados — dívida técnica pré-existente que não é responsabilidade desta tarefa.

### Armadilhas
- **Overengineering** → Resisti: não criei sistema de templates, preview em tempo real ou analytics. Apenas `<textarea>` + string.
- **"Aproveitar pra melhorar"** → Resisti: não refatorei `suggestText()`, não reorganizei imports, não toquei em `processQueue()`.
- **"Isso precisa ser genérico"** → Resisti: usei `string` pura, sem tipo customizado ou wrapper.
- **check-cleanup falso positivo #1** → Números `5511999999999` em JSDoc/placeholder eram exemplos de documentação, não dados reais. Anonimizados para `55XXXXXXXXXXX`.
- **check-cleanup falso positivo #2** → `55XXXXXXXXXXX@c.us` foi capturado como email pela regex de email. Substituído por descrição textual sem `@`.
