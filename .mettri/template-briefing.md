# Missão — {id} ({titulo})

## Identidade da Tarefa

- **Propósito:** {1 frase}
- **Escopo:** {módulos que toca}
- **NÃO tocar:** {módulos proibidos}

## Sabotagens Conhecidas

> domínio: {dominio} — catálogo: `sabotagens/{dominio}.md`

- ⚠️ {padrão 1} → como resistir: {estratégia}
- ⚠️ {padrão 2} → como resistir: {estratégia}

## Memória Herdada

> buscado em `memory.md` por tags do domínio `{dominio}`

- {tarefa similar}: {aprendizado relevante}
- {tarefa similar}: {aprendizado relevante}

## Viés de Simplificação

> Regra de ouro: resolva APENAS o que foi pedido. Nada além.

- Não crie abstrações para uso único. Três linhas similares > uma factory.
- Não adicione validação/fallback para cenários que não podem acontecer.
- Não refatore código ao redor. Só mexa no que o escopo pede.
- Não comente o óbvio. Só comente o PORQUÊ não óbvio.
- Tente o mais simples primeiro. Só complique se falhar.

---

## Informação Técnica

- **Arquivos relevantes:**
  - {path} — {breve descrição}
  - {path} — {breve descrição}
- **ZenSpec:** {caminho} — {contrato resumido em 1-2 frases}
- **Constraints:** TypeScript strict, Zod, nunca `any`

## Critério de Pronto

- [ ] {critério 1}
- [ ] {critério 2}
- [ ] lint passa (0 erros)
- [ ] typecheck passa (0 erros)
- [ ] build passa
- [ ] testes passam
- [ ] Nenhum arquivo fora do escopo modificado
