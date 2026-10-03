# 🤝 Guia de Contribuição

Este documento define as diretrizes para contribuição no projeto **LabStocker**.
O objetivo é manter o código organizado, padronizado e de fácil manutenção.

---

## 📌 Fluxo de Trabalho

1. Crie uma branch a partir da `main`
2. Desenvolva sua funcionalidade
3. Faça commits seguindo o padrão definido
4. Abra um Pull Request (PR)
5. Aguarde revisão antes do merge

---

## 🌿 Padrão de Branches

Utilize nomes descritivos seguindo o formato:

```
tipo/nome-da-feature
```

**Exemplos:**

```
feat/auth-login
feat/pedido-entre-laboratorios
fix/erro-aprovar-transferencia
refactor/organizacao-services
```

---

## 🧾 Padrão de Commits

Utilizamos o padrão **Conventional Commits**.

### 📌 Formato

```
<tipo>(escopo opcional): descrição
```

### ✏️ Exemplos

```
feat(estoque): adicionar cadastro de itens no estoque
fix(transferencia): corrigir direcao origem/destino na aprovacao
docs(readme): atualizar instrucoes do banco de dados
refactor(services): reorganizar camada de acesso a dados
```

### 📚 Tipos de Commits

- `feat` → nova funcionalidade
- `fix` → correção de bug
- `docs` → documentação
- `style` → alterações visuais (sem lógica)
- `refactor` → refatoração
- `test` → testes
- `chore` → tarefas gerais

### 🚫 Evitar

```
update code
ajustes
teste
```

---

## 🔀 Pull Requests (PR)

### 📌 Antes de abrir um PR

- Certifique-se de que o código funciona
- Revise seu próprio código
- Garanta que não há erros básicos
- Se a mudança mexe no banco, crie uma migration nova em `supabase/migrations/`, cubra a regra com teste em `supabase/tests/` e rode `npm run test:db` (veja `supabase/README.md`)

### 📌 O PR deve conter

- Descrição clara do que foi feito
- (Se aplicável) como testar a funcionalidade

### 📌 Exemplo de PR

```
## O que foi feito

Implementação do pedido de reagentes entre laboratórios

## Como testar

1. Entrar como usuário de um laboratório
2. Acessar "Laboratórios" > abrir outro laboratório > "Pedir" em um reagente
3. Entrar como gestor do laboratório de origem e confirmar que o pedido aparece em "Pedidos recebidos"

## Observações

Cria a migration `supabase/migrations/AAAAMMDDHHMMSS_pedido_entre_laboratorios.sql` (testada com `npm run db:reset` e `npm run test:db`). Aplicar com `npx supabase db push` antes do merge, porque o site publica sozinho a cada push na `main`.
```

---

## 📏 Boas Práticas

- Commits pequenos e frequentes
- Código legível e organizado
- Seguir a arquitetura definida do projeto:
  - `src/pages/` → telas (HTML + JS de cada página)
  - `src/shared/services/` → acesso a dados (Supabase)
  - `src/shared/utils/` → utilitários (toast, formatadores, validadores)
  - `supabase/migrations/` → banco versionado (tabelas, funções, políticas, migrations)
  - `supabase/tests/` → testes do banco (pgTAP)
- Manter a lógica de acesso a dados nos **services**, não direto nas páginas
- Não misturar múltiplas funcionalidades no mesmo PR

---

## 🚫 Regras Importantes

- Não commitar diretamente na branch `main`
- Todo código deve passar por revisão
- Evitar commits muito grandes ou genéricos
- Não commitar segredos/chaves: o `src/.env` é ignorado pelo Git e a chave `service_role` nunca vai para o repositório

---

## 📊 Organização da Equipe

- Cada integrante é responsável por suas tarefas
- O progresso deve ser atualizado regularmente
- Dúvidas devem ser discutidas antes de implementar soluções complexas

---

## 📌 Observação Final

Seguir estas diretrizes garante melhor organização do projeto, facilita a colaboração entre os membros da equipe e contribui para uma avaliação mais positiva do trabalho.
