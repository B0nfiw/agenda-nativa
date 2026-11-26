# Agenda Nativa

Site configurável para salões de beleza, com catálogo de serviços, seleção de profissional e formulário de solicitação de horário. A versão de portfólio usa um salão fictício e exibe a mensagem no navegador em modo de demonstração.

## Rodar localmente

Com Python 3, sirva a pasta `frontend` e abra [http://127.0.0.1:8080](http://127.0.0.1:8080).

```bash
python -m http.server 8080 --bind 127.0.0.1 --directory frontend
```

## Como funciona

- HTML, CSS e JavaScript sem dependências de execução.
- Serviços, equipe, horários e tema são carregados de `frontend/config.json`.
- O navegador valida o formulário e mostra uma prévia da solicitação.
- Para personalizar o modelo, use `npm run create-client` com Node.js. A cópia sai em `clientes/<nome>` e usa o telefone informado para abrir uma mensagem no WhatsApp. O salão confirma o horário pelo próprio WhatsApp.

## Testes

```bash
npm test
```
