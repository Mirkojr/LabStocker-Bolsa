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
feat/solicitar-transferencia
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

Implementação da solicitação de transferência de reagentes entre laboratórios

## Como testar

1. Entrar como usuário de um laboratório
2. Acessar "Laboratórios" > ver estoque de outro lab > "Solicitar"
3. Confirmar que o pedido aparece para o lab dono aprovar

## Observações

Rodar a migration `migracao_movimentacao.sql` no Supabase
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
- Não commitar segredos/chaves; conferir `src/shared/config.js` antes de subir

---

## 📊 Organização da Equipe

- Cada integrante é responsável por suas tarefas
- O progresso deve ser atualizado regularmente
- Dúvidas devem ser discutidas antes de implementar soluções complexas

---

## 📌 Observação Final

Seguir estas diretrizes garante melhor organização do projeto, facilita a colaboração entre os membros da equipe e contribui para uma avaliação mais positiva do trabalho.
