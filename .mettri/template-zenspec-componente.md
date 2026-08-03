# Template — ZenSpec de Componente (nome-descritivo.zenspec.md)

> Nível: **componente/programa** — a "filha". Uma por programa do pipeline.
> Mãe: `spec.md` da mesma pasta (conceito, engenharia, stack) — ver `template-zenspec.md`.
> Formato canônico: `../ZenSpecKit/ZenSpecKit/ZenSpec.md` — este template é o molde operacional.

---

## Regras de uso

1. **Nome do arquivo** completa a frase "Este programa existe para ___" — verbos no infinitivo, português. Ex: `montar-contexto-do-cliente.zenspec.md`.
2. **Criar:** quando o Sensei/o @gerir gera uma tarefa de tipo ZenSpec, ou quando um programa novo nasce.
3. **Atualizar:** quando contrato, pipeline, regras ou edge cases do programa mudarem.
4. **Ordem das seções de Lógica:** 1. Conceito, 2. Lógica, 3. Interface (se houver UI). Sem numeração fixa, mas SEMPRE esta ordem.
5. **Assinatura única:** a ordem e o nome dos parâmetros na spec DEVEM ser iguais à assinatura das funções no código e nos testes.
6. **Cada programa aparece em `código`** em tabelas, fluxos e texto — consistente, sem variação.
7. **Divergência código vs spec → spec vence.**

---

# {Nome descritivo} (`{nomeTecnico}`)

## Intenção

Esta feature/programa existe para que {quem} consiga {fazer o quê} sem precisar de {o quê}.

## Conceito

{2-3 frases — o que é, linguagem humana, sem contrato.}

## Lógica

### Pipeline / Fluxo

```
anterior → este_programa → próximo
```

| Programa | Recebe | Faz | Manda para |
|----------|--------|-----|------------|
| `{anterior}` | {entrada} | {o que faz} | `{este_programa}` |
| `{este_programa}` | {entrada} | {o que faz} | `{próximo}` ou — |

Precondição: {uma linha quando o programa depender de estado anterior; omitir se não houver}

### Contrato

Entrada:

- `{campo}`: {tipo}
- `{campo}`: {tipo}

Saída:

- `{campo}`: {tipo}
- `{campo}`: {tipo}

Erros:

- {código} → {condição}
- {código} → {condição}

> Nenhum comportamento pode existir fora do contrato declarado.

### Regras

- Se {condição} → {comportamento}.
- Se {condição} → {comportamento}.
- Falha explícita em I/O ou chamada externa — sem sucesso parcial silencioso.
- Idempotência/efeito (quando relevante): {reexecutar = mesmo resultado | só leitura | não persiste}.

### Edge cases

- Se {exceção} → {resultado}.
- Se {limite} → {resultado}.
- {Ex: DB vazio → []. | Erro ao acessar → falha explícita.}

### Critérios de aceitação

- [ ] {critério 1 mensurável}
- [ ] {critério 2 mensurável}
- [ ] Existe teste chamando a função com a mesma assinatura (parâmetros e ordem) da spec.

## Interface (se houver UI)

### Layout

{descrever layout — quem lê consegue desenhar a tela sem ler a Lógica inteira}

### Estados visuais

- {estado} → {como aparece}
- {estado} → {como aparece}

### Interações

- {ação do usuário} → {comportamento}
- {ação do usuário} → {comportamento}

## Escopo fora

- {o que este programa NÃO faz}
- {o que este programa NÃO faz}

---

## Check rápido de integridade

- [ ] Toda regra está na forma "Se X → Y"?
- [ ] Nenhum comportamento silencioso (sem regra correspondente)?
- [ ] Toda entrada tem saída rastreável?
- [ ] Linha de fluxo `anterior → este → próximo` presente?
- [ ] Programa aparece como `código` em tabelas, fluxos e texto?
- [ ] Alguém que não participou das discussões consegue derivar um caso de teste para cada regra sem perguntar?
