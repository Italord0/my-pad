# my-pad

Clone do [DontPad](https://dontpad.com/) desenvolvido com **Kotlin + Spring Boot + SQLite** no backend e **ReactJS** no frontend.

O objetivo é criar uma aplicação simples de compartilhamento de textos através de URLs, permitindo que múltiplos usuários acessem e editem o mesmo "pad", com sincronização em tempo real.

---

## 1. Objetivo

O usuário deve poder acessar uma URL como:

```text
https://dontpad.example.com/meu-pad
```

e imediatamente visualizar e editar o conteúdo associado ao identificador `meu-pad`.

Não será necessário criar uma conta para utilizar um pad.

Exemplo:

```text
https://dontpad.example.com/abc123
```

Todos que acessarem essa URL visualizarão o mesmo conteúdo.

---

## 2. Stack

### Backend

* Kotlin
* Spring Boot
* Spring Web
* Spring WebSocket
* SQLite
* Gradle

### Frontend

* ReactJS
* Vite
* JavaScript ou TypeScript
* React Router
* WebSocket API

### Infraestrutura

* Docker
* Docker Compose opcional para desenvolvimento
* Cloudflare Tunnel para exposição externa

---

## 3. Arquitetura

A aplicação será distribuída como uma única aplicação/container.

```text
                    Internet
                       │
                       ▼
               Cloudflare Tunnel
                       │
                       ▼
              ┌──────────────────┐
              │   Spring Boot    │
              │                  │
              │  REST API        │
              │  WebSocket       │
              │  React static    │
              │                  │
              └────────┬─────────┘
                       │
                       ▼
                   SQLite
                       │
                       ▼
                 /data/dontpad.db
```

O Spring Boot será responsável por:

* API REST
* WebSocket
* Persistência
* Servir os arquivos estáticos do React em produção

O React será responsável pela interface e comunicação com o backend.

---

# 4. Conceito de Pad

Cada pad será identificado por um `slug`.

Exemplo:

```text
/meu-pad
```

corresponde ao registro:

```text
slug = "meu-pad"
```

Outro usuário acessando:

```text
/meu-pad
```

acessará exatamente o mesmo conteúdo.

---

# 5. Fluxo de acesso

Quando o usuário acessar:

```text
https://dontpad.example.com/meu-pad
```

o React deverá:

1. Obter o `slug` através da URL.
2. Solicitar o conteúdo ao backend.
3. Exibir o conteúdo no editor.
4. Abrir uma conexão WebSocket para o pad.
5. Receber alterações realizadas por outros usuários.
6. Enviar alterações realizadas pelo usuário.

Fluxo:

```text
Browser
   │
   │ GET /api/pads/meu-pad
   ▼
Backend
   │
   ▼
SQLite
   │
   ▼
Conteúdo inicial
   │
   ▼
React
   │
   │ WS /ws/pads/meu-pad
   ▼
WebSocket
```

---

# 6. API REST

## GET `/api/pads/{slug}`

Obtém o conteúdo de um pad.

Exemplo:

```http
GET /api/pads/meu-pad
```

Resposta:

```json
{
  "slug": "meu-pad",
  "content": "Olá mundo!",
  "createdAt": "2026-08-13T00:00:00Z",
  "updatedAt": "2026-08-13T00:10:00Z"
}
```

### Pad inexistente

Para simplificar o funcionamento do DontPad, um pad inexistente poderá ser criado automaticamente no primeiro acesso.

Exemplo:

```http
GET /api/pads/novo-pad
```

Se `novo-pad` não existir:

```text
GET
 ↓
não encontrado
 ↓
INSERT
 ↓
retorna pad vazio
```

Resposta:

```json
{
  "slug": "novo-pad",
  "content": ""
}
```

---

## PUT `/api/pads/{slug}`

Endpoint opcional para salvar o conteúdo diretamente através de HTTP.

```http
PUT /api/pads/meu-pad
Content-Type: application/json
```

Body:

```json
{
  "content": "Novo conteúdo"
}
```

Esse endpoint poderá ser utilizado inicialmente durante o desenvolvimento.

Com a implementação do WebSocket, a atualização em tempo real deverá preferencialmente ocorrer através dele.

---

# 7. WebSocket

Endpoint:

```text
/ws/pads/{slug}
```

Exemplo:

```text
wss://dontpad.example.com/ws/pads/meu-pad
```

Cada pad terá seu próprio canal de comunicação.

```text
Pad: meu-pad

Alice ─────┐
           │
Bob ───────┼── WebSocket ── Spring Boot
           │
Carlos ────┘
```

Quando um usuário fizer uma alteração, o backend deverá:

1. Receber a alteração.
2. Processar a alteração.
3. Persistir o estado no SQLite.
4. Enviar a alteração aos demais usuários conectados ao mesmo pad.

---

# 8. Mensagens WebSocket

A implementação inicial poderá trabalhar com mensagens simples.

## Update

Cliente → servidor:

```json
{
  "type": "update",
  "content": "Olá mundo!"
}
```

Servidor → clientes:

```json
{
  "type": "update",
  "content": "Olá mundo!"
}
```

---

## Inicialização

Quando um usuário conectar ao WebSocket, o servidor poderá enviar o estado atual:

```json
{
  "type": "initial",
  "content": "Conteúdo atual do pad"
}
```

---

# 9. Concorrência

O MVP inicialmente utilizará uma estratégia simples de sincronização.

A primeira implementação poderá trabalhar com:

```text
Last Write Wins
```

Ou seja, quando duas alterações ocorrerem simultaneamente, a última alteração processada pelo servidor será considerada o estado atual.

Exemplo:

```text
Estado inicial:
Hello

Alice:
Hello Alice

Bob:
Hello Bob
```

Se a alteração de Bob for processada por último:

```text
Hello Bob
```

será o estado armazenado.

Essa estratégia é aceitável para o MVP, mas poderá causar perda de alterações em edições simultâneas.

---

# 10. Evolução para edição colaborativa

Caso seja necessário suportar edição simultânea sem perda de alterações, a arquitetura poderá evoluir para:

* CRDT
* Operational Transformation

Nesse cenário, o sistema deixará de enviar o documento inteiro a cada alteração e passará a trabalhar com operações de edição.

Exemplo conceitual:

```json
{
  "type": "insert",
  "position": 5,
  "text": " World"
}
```

A implementação de CRDT não faz parte do MVP inicial.

---

# 11. Banco de dados

Será utilizado SQLite.

Banco:

```text
dontpad.db
```

O arquivo ficará em um diretório persistente do container:

```text
/data/dontpad.db
```

No Docker:

```text
Volume
  │
  ▼
/data
  └── dontpad.db
```

Isso garante que os dados não sejam perdidos quando o container for recriado.

---

# 12. Modelo de dados

Tabela inicial:

```sql
CREATE TABLE pads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
```

### Campos

| Campo        | Tipo    | Descrição                    |
| ------------ | ------- | ---------------------------- |
| `id`         | INTEGER | Identificador interno        |
| `slug`       | TEXT    | Identificador público do pad |
| `content`    | TEXT    | Conteúdo do pad              |
| `created_at` | TEXT    | Data de criação              |
| `updated_at` | TEXT    | Última atualização           |

O `slug` deverá possuir um índice/constraint `UNIQUE`.

---

# 13. Estrutura do backend

Sugestão:

```text
backend/
└── src/
    └── main/
        └── kotlin/
            └── com.example.dontpad/
                ├── DontPadApplication.kt
                │
                ├── pad/
                │   ├── Pad.kt
                │   ├── PadRepository.kt
                │   ├── PadService.kt
                │   ├── PadController.kt
                │   └── PadWebSocketHandler.kt
                │
                └── config/
                    └── WebSocketConfig.kt
```

A estrutura poderá ser reorganizada conforme o projeto crescer.

---

# 14. Estrutura do frontend

Sugestão:

```text
frontend/
├── src/
│   ├── components/
│   │   ├── PadEditor/
│   │   └── ...
│   │
│   ├── pages/
│   │   ├── HomePage/
│   │   └── PadPage/
│   │
│   ├── services/
│   │   ├── api.js
│   │   └── websocket.js
│   │
│   ├── router/
│   │   └── routes.jsx
│   │
│   ├── App.jsx
│   └── main.jsx
│
├── package.json
└── vite.config.js
```

---

# 15. Rotas do React

```text
/
```

Página inicial.

```text
/:slug
```

Página do pad.

Exemplos:

```text
/abc123
/meu-pad
/projeto
/anotacoes
```

Todos deverão renderizar o mesmo componente:

```text
PadPage
```

O `slug` será obtido através do React Router.

---

# 16. Comunicação React → Backend

Ao abrir:

```text
/meu-pad
```

o React executará:

```text
GET /api/pads/meu-pad
```

Depois abrirá:

```text
WS /ws/pads/meu-pad
```

Arquitetura:

```text
PadPage
   │
   ├── Pad API
   │
   └── Pad WebSocket
```

---

# 17. Servindo o React pelo Spring Boot

Durante desenvolvimento:

```text
React
localhost:5173

Spring Boot
localhost:8080
```

Durante produção:

```text
Spring Boot
localhost:8080
    │
    ├── /api/**
    ├── /ws/**
    └── React static files
```

O usuário acessará apenas:

```text
https://dontpad.example.com
```

Não haverá necessidade de expor uma porta separada para o React.

---

# 18. Docker

A aplicação será empacotada em uma única Docker image.

Conceito:

```text
Docker Image
│
└── Spring Boot
    ├── Backend
    ├── WebSocket
    ├── React build
    └── SQLite runtime
```

O Dockerfile deverá utilizar multi-stage build.

### Stage 1 — Frontend

```text
Node.js
   ↓
npm install
   ↓
npm run build
   ↓
dist/
```

### Stage 2 — Backend

```text
Gradle
   ↓
./gradlew bootJar
   ↓
app.jar
```

### Stage 3 — Runtime

```text
JRE
   +
app.jar
   +
React build
```

---

# 19. Docker Volume

O SQLite deverá utilizar um volume:

```text
/data
```

Exemplo:

```bash
docker run -d \
  --name dontpad \
  -p 8080:8080 \
  -v dontpad-data:/data \
  dontpad:latest
```

O banco ficará em:

```text
/data/dontpad.db
```

---

# 20. Cloudflare Tunnel

A aplicação deverá funcionar atrás de um Cloudflare Tunnel.

Fluxo:

```text
Internet
   │
   ▼
Cloudflare
   │
   ▼
Cloudflare Tunnel
   │
   ▼
localhost:8080
   │
   ▼
DontPad
```

Como REST, React e WebSocket utilizarão a mesma aplicação/porta, apenas uma origem será necessária.

---

# 21. MVP

A primeira versão deverá conter apenas:

* [ ] Criar/acessar pad através de slug
* [ ] Editor de texto
* [ ] Persistência SQLite
* [ ] API REST
* [ ] WebSocket
* [ ] Atualização em tempo real
* [ ] React Router
* [ ] Spring Boot servindo o frontend
* [ ] Docker
* [ ] Volume persistente

A estratégia inicial de sincronização será `Last Write Wins`.

---

# 22. Funcionalidades futuras

Possíveis funcionalidades:

* [ ] CRDT para edição colaborativa
* [ ] Histórico de alterações
* [ ] Contador de usuários conectados
* [ ] Indicador de usuários editando
* [ ] Última alteração
* [ ] Expiração automática de pads
* [ ] Exclusão automática de pads inativos
* [ ] Password para pads
* [ ] Pads privados
* [ ] Exportar conteúdo
* [ ] Markdown
* [ ] Syntax highlighting
* [ ] Dark mode
* [ ] Limite de tamanho do pad
* [ ] Rate limiting
* [ ] Proteção contra spam
* [ ] Métricas

---

# 23. Decisões arquiteturais iniciais

### Banco

**SQLite**

Motivo:

* Simples
* Arquivo único
* Fácil backup
* Excelente para uma aplicação pequena
* Fácil utilização em Docker
* Não exige um banco separado

### Backend

**Kotlin + Spring Boot**

Motivo:

* Familiaridade com Kotlin
* Suporte a REST
* Suporte a WebSocket
* Ecossistema maduro
* Fácil integração com SQLite

### Frontend

**ReactJS**

Motivo:

* Interface simples
* Ecossistema amplo
* React Router
* Fácil comunicação com REST/WebSocket

### Deploy

**Uma única Docker image**

Motivo:

* Instalação simples
* Ideal para CasaOS
* Apenas uma porta
* Fácil gerenciamento
* Fácil backup através do volume SQLite

---

# 24. Arquitetura final esperada

```text
                         Internet
                            │
                            ▼
                    Cloudflare Tunnel
                            │
                            ▼
                    ┌───────────────┐
                    │    Docker     │
                    │               │
                    │ Spring Boot   │
                    │       │       │
                    │       ├── REST│
                    │       │       │
                    │       ├── WS   │
                    │       │       │
                    │       ├── React│
                    │       │       │
                    │       ▼       │
                    │     SQLite    │
                    │       │       │
                    └───────┼───────┘
                            │
                            ▼
                    /data/dontpad.db
```

---

# 25. Primeiro objetivo de implementação

A primeira milestone será fazer o seguinte fluxo funcionar:

```text
1. Usuário acessa /meu-pad
          ↓
2. React identifica "meu-pad"
          ↓
3. GET /api/pads/meu-pad
          ↓
4. Spring procura no SQLite
          ↓
5. Se não existir, cria
          ↓
6. React mostra o conteúdo
          ↓
7. React abre WS /ws/pads/meu-pad
          ↓
8. Usuário edita
          ↓
9. WebSocket envia alteração
          ↓
10. Spring salva no SQLite
          ↓
11. Spring envia alteração aos outros usuários
```

Esse fluxo será a base de todo o projeto.
