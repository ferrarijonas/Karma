# Template — ZenSpec de Módulo (spec.md)

> Nível: **módulo/domínio** — a "mãe". Guarda-chuva de conceito, engenharia e stack.
> Filhas: `nome-descritivo.zenspec.md` (uma por programa/componente) — ver `template-zenspec-componente.md`.
> Formato canônico: `../ZenSpecKit/ZenSpecKit/ZenSpec.md` — este template é o molde operacional.

---

## Regras de uso

1. **Uma por pasta de domínio.** Nome do arquivo: `spec.md` (sem prefixo descritivo).
2. **Spec diz o quê; plano e código dizem como.** Não misturar requisito com implementação.
3. **O que está na spec é o sistema. O que não está, não existe.**
4. **Criar:** quando o domínio nasce (primeira tarefa do domínio cria a spec-mãe — tarefa zero em greenfield).
5. **Atualizar:** quando regra de negócio, conceito, interface ou decisão de engenharia mudar.
6. **Contrato de componente vive SÓ na filha.** A mãe mantém referência e contexto de negócio.
7. **Divergência código vs spec → spec vence.** Alteração no sistema exige alteração prévia na spec.

---

# {Nome do Domínio} (spec.md)

## Conceito

{2-3 frases — o que é este domínio, em linguagem humana, sem contrato.
Quem lê o Conceito entende o negócio sem ler o resto.}

Esta feature/domínio existe para que {quem} consiga {fazer o quê} sem precisar de {o quê}.

## Engenharia

### Stack

- **Linguagem/runtime:** {ex: TypeScript strict, Node 20}
- **Principais dependências:** {ex: zod, vitest, fake-indexeddb}
- **Storage:** {ex: IndexedDB, arquivos, banco}
- **Testes:** {ex: vitest, unit + e2e}
- **Plataforma alvo:** {ex: browser extension, CLI, serviço}

### Decisões de engenharia

- {decisão 1} — {porquê, em 1-2 linhas}
- {decisão 2} — {porquê, em 1-2 linhas}
- {decisão que substitui X} — {porquê} (para regras já contestadas)

### Estrutura

{árvore de pastas do domínio, se relevante — 1 nível, sem detalhar contratos}

## Stack / Dependências

| Recurso | Onde | Observação |
|---------|------|------------|
| {recurso} | {caminho} | {nota} |

## Componentes (filhas)

| Programa | Arquivo filha | Status |
|----------|---------------|--------|
| `{nomeTecnico}` | `{nome-descritivo}.zenspec.md` | {criada | pendente} |
| `{nomeTecnico}` | `{nome-descritivo}.zenspec.md` | {criada | pendente} |

> Contrato, pipeline e edge cases de cada programa vivem na filha — não duplicar aqui.

## Escopo fora

- {o que esta spec NÃO cobre}
- {o que esta spec NÃO cobre}

## Critérios de aceitação (módulo)

- [ ] {critério mensurável do domínio}
- [ ] {critério mensurável do domínio}

---

## Exemplo de nome de arquivo

| Nome técnico (no código) | Nome do arquivo filha |
| ------------------------ | --------------------- |
| `retomarContextResolver` | `montar-contexto-do-cliente.zenspec.md` |
| `retomarBaselineAgent`   | `gerar-mensagem-baseline.zenspec.md` |

> Nome do arquivo `.zenspec.md` completa a frase: **"Este programa existe para ___"** — verbos no infinitivo, português.
