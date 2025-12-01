# Meu Cantinho

Sistema para gerenciamento de aluguel de espaços para festas (salões, chácaras, quadras, etc.).

Arquitetura em 3 partes:

- **Frontend**: SPA em Vue 3 + Vite (interface web)
- **Backend**: API REST em Node.js + Express + TypeScript
- **Banco de dados**: PostgreSQL 16

Tudo é executado via **Docker Compose**.

---

## Como subir o projeto (Docker)

1. Clone o repositório e entre na pasta:

```bash
git clone <URL-DO-REPOSITORIO>
cd meu-cantinho
```


2. Suba os serviços (primeira vez ou após mudanças de Dockerfile):

docker compose up --build


3. Nas próximas vezes, pode usar apenas:

docker compose up


4. Para parar todos os containers:

docker compose down

5. Serviços e portas

Os serviços definidos em docker-compose.yml sobem nas seguintes portas do host:

## Serviços e portas

| Serviço  | Descrição                          | Porta | URL                               |
|----------|------------------------------------|-----------:|-----------------------------------|
| Banco    | PostgreSQL            | **5433**   | (para uso em DBeaver/psql, etc.)  |
| Backend  | API REST (Node + Express + TS)     | **3000**   | http://localhost:3000             |
| Frontend | SPA Vue 3 + Vite                   | **5173**   | http://localhost:5173             |


