# Diagrama entidade-relacionamento

Tabelas do schema `public` criadas pelas migrations de `supabase/migrations/`. Este arquivo
é a única fonte do diagrama: ao criar ou alterar uma tabela numa migration, atualize-o no
mesmo PR. O GitHub desenha o Mermaid direto na página.

- `perfis.id_laboratorio` e `perfis.is_admin` são legados; o acesso vem de
  `vinculo_laboratorio` e `administrador`.
- `auditoria.id_registro` e `auditoria.id_laboratorio` não têm FK de propósito: o registro
  continua existindo depois que o item ou o laboratório é excluído.
- `pedido_vinculo` está preparada para uma próxima etapa e ainda não é usada.

```mermaid
erDiagram
    AUTH_USERS {
        uuid id PK
        text email
    }

    LABORATORIO {
        uuid id PK
        text nome_laboratorio
        text codigo_sipac
        timestamptz data_criacao
    }

    REAGENTE {
        uuid id PK
        text nome
        text composicao_quimica
        timestamptz data_criacao
        text instituicao_controladora
        text numero_cas
    }

    PERFIS {
        uuid id PK, FK
        text nome
        text sobrenome
        text tipo_identificador
        text identificador
        uuid id_laboratorio FK
        boolean is_admin
        text email
        text cargo
    }

    ESTOQUELAB {
        uuid id PK
        uuid id_laboratorio FK
        uuid id_reagente FK
        numeric quantidade
        text unidade_medida
        date data_validade
        text observacoes_operacionais
        timestamptz data_atualizacao
    }

    RESIDUO {
        uuid id PK
        uuid id_laboratorio FK
        text descricao
        text tipo_perigo
        numeric quantidade
        text unidade_medida
        text status
        timestamptz data_criacao
        uuid id_consumo FK
        uuid id_usuario FK
    }

    TRANSFERENCIA {
        uuid id PK
        uuid id_item_estoque FK
        uuid id_lab_origem FK
        uuid id_lab_destino FK
        numeric quantidade_transferida
        text status
        text motivo_recusa
        timestamptz data_solicitacao
    }

    FEEDBACK {
        uuid id PK
        uuid user_id FK
        text tipo
        text mensagem
        text status
        timestamptz data_envio
    }

    PROJETOS {
        uuid id PK
        timestamptz created_at
        uuid user_id FK
        text responsavel_nome
        text responsavel_siape
        text responsavel_cpf
        text responsavel_email
        text responsavel_telefone
        text titulo_projeto
        text orgao_financiador
        text registro_numero
        text periodo_execucao
        text lab_nome
        text lab_sipac
        jsonb produtos
        text status
        text motivo_recusa
        text cargo_responsavel
        text departamento_responsavel
        text unidade_academica
        text local_atividades
        text depto_atividades
        text orgao_controlador
        text documento_url
        text pdf_assinado_url
    }

    MOVIMENTACAO {
        uuid id PK
        uuid id_laboratorio FK
        text tipo
        text item_nome
        numeric quantidade
        text unidade
        text observacao
        timestamptz data_movimentacao
    }

    CONSUMO {
        uuid id PK
        uuid id_laboratorio FK
        uuid id_item_estoque FK
        uuid id_reagente FK
        uuid id_usuario FK
        numeric quantidade
        text unidade_medida
        text finalidade
        timestamptz data_consumo
    }

    VINCULO_LABORATORIO {
        uuid id PK
        uuid id_usuario FK
        uuid id_laboratorio FK
        text papel
        uuid concedido_por FK
        timestamptz concedido_em
        timestamptz expira_em
        text observacao
        uuid revogado_por FK
        timestamptz revogado_em
        text motivo_revogacao
    }

    ADMINISTRADOR {
        uuid id PK
        uuid id_usuario FK
        uuid concedido_por FK
        timestamptz concedido_em
        text observacao
        uuid revogado_por FK
        timestamptz revogado_em
        text motivo_revogacao
    }

    PEDIDO_VINCULO {
        uuid id PK
        uuid id_usuario FK
        uuid id_laboratorio FK
        text mensagem
        text status
        timestamptz criado_em
        uuid decidido_por FK
        timestamptz decidido_em
    }

    AUDITORIA {
        bigint id PK
        text tabela
        uuid id_registro
        uuid id_laboratorio
        text acao
        text origem
        text motivo
        text item_nome
        jsonb dados_antes
        jsonb dados_depois
        uuid id_usuario FK
        timestamptz data_registro
    }

    AUTH_USERS ||--o{ PERFIS : "id"
    AUTH_USERS ||--o{ FEEDBACK : "user_id"
    AUTH_USERS ||--o{ PROJETOS : "user_id"

    LABORATORIO ||--o{ PERFIS : "id_laboratorio (legado)"
    LABORATORIO ||--o{ ESTOQUELAB : "id_laboratorio"
    REAGENTE ||--o{ ESTOQUELAB : "id_reagente"

    LABORATORIO ||--o{ RESIDUO : "id_laboratorio"
    CONSUMO ||--o{ RESIDUO : "id_consumo"
    PERFIS ||--o{ RESIDUO : "id_usuario"

    ESTOQUELAB ||--o{ TRANSFERENCIA : "id_item_estoque"
    LABORATORIO ||--o{ TRANSFERENCIA : "id_lab_origem"
    LABORATORIO ||--o{ TRANSFERENCIA : "id_lab_destino"

    LABORATORIO ||--o{ MOVIMENTACAO : "id_laboratorio"

    LABORATORIO ||--o{ CONSUMO : "id_laboratorio"
    ESTOQUELAB ||--o{ CONSUMO : "id_item_estoque"
    REAGENTE ||--o{ CONSUMO : "id_reagente"
    PERFIS ||--o{ CONSUMO : "id_usuario"

    PERFIS ||--o{ VINCULO_LABORATORIO : "id_usuario"
    LABORATORIO ||--o{ VINCULO_LABORATORIO : "id_laboratorio"
    PERFIS ||--o{ VINCULO_LABORATORIO : "concedido_por"
    PERFIS ||--o{ VINCULO_LABORATORIO : "revogado_por"

    PERFIS ||--o{ ADMINISTRADOR : "id_usuario"
    PERFIS ||--o{ ADMINISTRADOR : "concedido_por"
    PERFIS ||--o{ ADMINISTRADOR : "revogado_por"

    PERFIS ||--o{ PEDIDO_VINCULO : "id_usuario"
    LABORATORIO ||--o{ PEDIDO_VINCULO : "id_laboratorio"
    PERFIS ||--o{ PEDIDO_VINCULO : "decidido_por"

    PERFIS ||--o{ AUDITORIA : "id_usuario"
```
