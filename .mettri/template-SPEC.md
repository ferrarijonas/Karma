---
id: "{DDMM-001}"
titulo: ""
dominio: ""
status: "pendente"
prioridade: 3
dependencias: []
bloqueado_por: []
bloqueia: []
tentativas: 0
max_tentativas: 3
nivel_auto_cura: null
backoff_ms: 10000
max_backoff_ms: 300000
criado_em: ""
iniciado_em: null
concluido_em: null
heartbeat_ultimo: null
estimativa_min: 30
timeout_min: 90
escopo:
  modulos: []
  nao_tocar: []
spec_ref: ""
tipo_output: "codigo"
migracao_necessaria: false
permite_mock: false
---

# {DDMM-001}: {titulo}

## Propósito

{1 frase — por que esta tarefa existe}

## Escopo

- **Toca:** {módulos, arquivos}
- **NÃO toca:** {módulos, arquivos proibidos}

## O que já existe

- {arquivo 1} — {breve descrição do que faz}
- {arquivo 2} — {breve descrição do que faz}
- {módulo ou spec relacionado}

## Onde verificar / input

- {caminho 1} — {o que buscar nesse local}
- {caminho 2} — {o que buscar nesse local}

## O que produzir / output

- {entregável concreto — arquivo, diff, relatório}

## Onde salvar

- {pasta de destino}

## Como validar

- [ ] {critério 1 mensurável}
- [ ] {critério 2 mensurável}
- [ ] lint passa (0 erros)
- [ ] typecheck passa (0 erros)
- [ ] construir passa
- [ ] testes passam
- [ ] Nenhum arquivo fora do escopo modificado

## Mock Policy

- `permite_mock: {false | true}` — definido no YAML frontmatter
- **false (padrão):** nenhum mock é permitido. Testes devem usar integração real (bater em endpoint, ler banco de verdade, usar browser). Se precisar mockar, justifique e peça aprovação.
- **true:** mocks permitidos apenas para: (1) ambiente de CI sem acesso ao recurso real, (2) teste de unidade de função pura que depende de I/O não disponível, (3) simulação de erro externo não reproduzível. Documente cada mock com `// justificado: <motivo>`.

---

## Sabotagens Herdadas

> domínio: {dominio} — catálogo: `sabotagens/{dominio}.md`

- ⚠️ {padrão 1} → {como resistir}
- ⚠️ {padrão 2} → {como resistir}

## Memória Herdada

> buscado em `memory.md` por tags do domínio `{dominio}`

- {tarefa similar}: {aprendizado relevante}
- {tarefa similar}: {aprendizado relevante}
