---
id: "T-056"
titulo: "Frase base no Respostas Agênticas do Retomar"
dominio: "marketing.retomar"
status: "concluida"
prioridade: 3
dependencias: []
bloqueado_por: []
bloqueia: []
tentativas: 0
max_tentativas: 3
nivel_auto_cura: null
backoff_ms: 10000
max_backoff_ms: 300000
criado_em: "2026-07-07"
iniciado_em: "2026-07-07"
concluido_em: "2026-07-07"
heartbeat_ultimo: "2026-07-07T00:00:00Z"
estimativa_min: 30
timeout_min: 60
escopo:
  modulos:
    - "src/modules/marketing/retomar/ai-suggestion.ts"
    - "src/modules/marketing/retomar/agente-retomar-prompt.ts"
    - "src/modules/marketing/retomar/retomar-panel.ts"
  nao_tocar:
    - "skills/retomar/SKILL.md"
    - "suggestText() em ai-suggestion.ts"
    - "processQueue() em retomar-panel.ts"
    - "fluxo 'Sugerir com IA' (copywriter A→B)"
spec_ref: "skills/retomar/SKILL.md"
tipo_output: "codigo"
migracao_necessaria: false
permite_mock: false
modo: "normal"
cleanup_permite_dados_pessoais: false
cleanup_permite_tokens: false
cleanup_permite_temp_files: false
---

# T-056: Frase base no Respostas Agênticas do Retomar

## Propósito

Permitir que o usuário digite uma "frase base" (ex: "Oi %NOME%, joia? Precisando de Pão pra semana?") que guie o tom das mensagens geradas pelo agente de retomada, sem substituir a personalização por contato.

## Escopo

- **Toca:**
  - `src/modules/marketing/retomar/ai-suggestion.ts` — `suggestRedacaoRetomar()` ganha parâmetro opcional `fraseBase?: string`
  - `src/modules/marketing/retomar/agente-retomar-prompt.ts` — `buildAgenteRetomarMessages()` ganha parâmetro `fraseBase` e injeta no prompt system
  - `src/modules/marketing/retomar/retomar-panel.ts` — adiciona `<textarea>` no painel de Respostas Agênticas (antes do botão "Gerar textos para selecionados")
- **NÃO toca:**
  - `skills/retomar/SKILL.md` — permanece canônica, sem alterações
  - Nenhum outro arquivo fora dos 3 listados
  - Função `suggestText()` — fluxo copywriter A→B permanece inalterado
  - Fluxo de envio `processQueue()` — permanece inalterado
  - NÃO usar AgentLoop — é para versão futura

## O que já existe

- `src/modules/marketing/retomar/ai-suggestion.ts` — `suggestRedacaoRetomar(bridge, params)` carrega a skill canônica, monta o prompt via `buildAgenteRetomarMessages()`, chama DeepSeek e retorna a mensagem gerada. Atualmente não aceita frase base.
- `src/modules/marketing/retomar/agente-retomar-prompt.ts` — `buildAgenteRetomarMessages(skillBody, fill)` substitui placeholders da skill (`{firstName}`, `{cycleIndex}`, etc.) e retorna `{ system, user }`. O system é o corpo completo da skill com dados do contato; o user é a instrução "Gere a mensagem."
- `src/modules/marketing/retomar/retomar-panel.ts` — `RetomarPanel.renderAgenticDetailPanel()` renderiza o bloco "Respostas Agênticas" com lista de contatos, checkboxes, textareas de rascunho e botão "Gerar textos para selecionados". O clique dispara `runAgenticGenerateForChatIds()` que itera os contatos e chama `suggestRedacaoRetomar()`.
- `skills/retomar/SKILL.md` — contrato moral do agente de retomada. Define regras por ciclo, calibragem de tom, anti-repetição, formato de saída. Contrato canônico — o código implementa, não modifica.

## Onde verificar / input

- `src/modules/marketing/retomar/ai-suggestion.ts` — assinatura de `suggestRedacaoRetomar()`, linha 166
- `src/modules/marketing/retomar/agente-retomar-prompt.ts` — assinatura de `buildAgenteRetomarMessages()`, linha 89
- `src/modules/marketing/retomar/retomar-panel.ts` — `renderAgenticDetailPanel()`, linha 1812; `runAgenticGenerateForChatIds()`, linha 1878; `setupAgenticListeners()`, linha 2064
- `skills/retomar/SKILL.md` — contrato canônico (leitura obrigatória, sem modificação)

## O que produzir / output

- **`src/modules/marketing/retomar/ai-suggestion.ts`:** parâmetro `fraseBase?: string` adicionado a `suggestRedacaoRetomar()`, repassado para `buildAgenteRetomarMessages()`
- **`src/modules/marketing/retomar/agente-retomar-prompt.ts`:** parâmetro `fraseBase?: string` em `buildAgenteRetomarMessages()`; quando fornecido, injeta no system prompt: `"O usuário sugeriu este tom/base: {fraseBase}. Use-a como inspiração, mas personalize com os dados do contato."`
- **`src/modules/marketing/retomar/retomar-panel.ts`:** campo `agenticFraseBase` (string) no estado da classe; `<textarea>` com placeholder "Frase base (opcional) — ex: Oi %NOME%, joia? Precisando de Pão?" renderizado em `renderAgenticDetailPanel()` ANTES do botão "Gerar textos para selecionados"; valor lido em `runAgenticGenerateForChatIds()` e repassado a `suggestRedacaoRetomar()`

## Como validar

- [ ] `suggestRedacaoRetomar` aceita `fraseBase` opcional e repassa ao prompt builder
- [ ] `buildAgenteRetomarMessages` inclui a frase base no system prompt quando fornecida (após os dados do contato, antes da instrução final)
- [ ] Campo de frase base (`<textarea>`) visível na UI do painel de Respostas Agênticas, antes do botão "Gerar textos para selecionados"
- [ ] `runAgenticGenerateForChatIds()` lê `this.agenticFraseBase` e repassa para `suggestRedacaoRetomar()`
- [ ] Gate-runner GREEN (lint, typecheck, construir, testes)
- [ ] Mensagens geradas COM frase base respeitam o tom sugerido mas são personalizadas por contato (nome, ciclo, histórico)
- [ ] Mensagens geradas SEM frase base comportam-se exatamente como antes (regressão zero)
- [ ] Nenhum arquivo fora do escopo modificado

## Mock Policy

- `permite_mock: false` — testes devem usar integração real ou existente. Nenhum mock novo é necessário para esta tarefa (a funcionalidade é passagem de string).

## Modo de Execução

- `modo: normal` — aplicar escada de decisão integralmente. 3 arquivos, mudanças cirúrgicas. Sem overengineering.

---

## Sabotagens Herdadas

> domínio: marketing.retomar — sem catálogo de sabotagens específico. Usa globais do Karma + as específicas da tarefa.

- ⚠️ **Overengineering** — não criar sistema de templates, não criar preview em tempo real, não adicionar analytics de uso da frase base → implementar apenas o `<textarea>` + passagem da string
- ⚠️ **"Aproveitar pra melhorar"** — não refatorar o `ai-suggestion.ts` inteiro, não tocar no `suggestText()`, não reorganizar imports → mudar apenas o necessário nos 3 arquivos
- ⚠️ **"Isso precisa ser genérico"** — a frase base é uma string passada como parâmetro. Não precisa de tipo customizado, wrapper ou abstração → string pura
- ⚠️ **Postergar porque "não está pronto"** — a SKILL.md não muda, o fluxo de envio não muda, a mudança é incremental e de baixo risco → implementar direto

## Memória Herdada

> Sem entradas em `memory.md` para o domínio `marketing.retomar` com esta tarefa. T-053 e T-054 tocaram o mesmo domínio mas não têm aprendizados cross-tarefa registrados.
