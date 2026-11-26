# Lave aí

Sistema web para agendamento e acompanhamento de uso de lavadoras e secadoras em lavanderias compartilhadas.

## Integrantes

- João Carlos Ferraz de Sousa | Matrícula: 2023087990
- Luiz Felipe Gondim Araujo | Matrícula: 2023028188

## Sobre o sistema

O Lave aí substitui o controle em papel de lavanderias compartilhadas, como os modelos de moradias universitárias, por uma fila digital com acompanhamento em tempo real. A aplicação atende dois perfis de usuário: usuários comuns, que criam a própria conta no sistema, e administradores, cadastrados via seed inicial no banco de dados.

Principais funcionalidades implementadas:

- Painel ao vivo separando lavadoras e secadoras, mostrando quais máquinas estão livres, em uso, aguardando retirada ou em manutenção, além de avisos visuais para o usuário logado sobre início, término e cancelamento de ciclos.
- Agendamento sequencial sem intervalos vazios. Ao escolher uma máquina e um ciclo vinculado a ela, o sistema calcula o próximo horário livre disponível, encaixando o agendamento em janelas livres quando a duração cabe antes do próximo da fila ou posicionando no final da fila quando não cabe.
- Controle de tempo de reserva entre a duração exata do ciclo e até 15 minutos adicionais. Quando o usuário reserva apenas o tempo exato do ciclo, o sistema adiciona automaticamente 10 minutos de folga para colocar e retirar as roupas.
- Cancelamento automático por atraso. Se o tempo restante da janela ficar menor do que a duração do ciclo escolhido, o agendamento é cancelado e sai da fila ativa, liberando para o próximo usuário da sequência assumir a máquina sem atrasar os demais.
- Área administrativa para cadastrar, editar, colocar em manutenção e remover lavadoras e secadoras, além de gerenciar os ciclos específicos de cada equipamento.
- Histórico de agendamentos com cancelamento de reservas futuras para usuários comuns e visão de auditoria para administradores, incluindo todos os agendamentos e o log de modificações nas máquinas.

## Tecnologias

O projeto foi estruturado como um monorepo dividido em `backend` e `frontend`.

No backend, utilizamos Node.js com TypeScript, Fastify para a API REST, `@fastify/cors` e `@fastify/cookie` para controle de sessão por cookies HTTP, Knex.js com SQLite (`better-sqlite3`) para persistência, migrations e seeds, Zod para validação de entrada e `bcrypt` para hash de senhas.

No frontend, utilizamos React 19 com Vite e CSS puro para interface responsiva.

Para testes e integração contínua, utilizamos Vitest com Supertest e cobertura via Istanbul no backend, Vitest com React Testing Library, MSW e cobertura via V8 no frontend, Cypress para testes end-to-end e GitHub Actions executando build, testes e verificação de cobertura em Linux, macOS e Windows.

## Uso de IA

Ferramentas de inteligência artificial (como Gemini e ChatGPT) foram utilizadas de forma pontual como apoio ao grupo. No início do projeto, usamos IA para organizar as ideias iniciais do problema, estruturar as regras da fila sequencial e definir a modelagem básica das tabelas. Em seguida, recorremos a ela para tirar dúvidas na configuração inicial do monorepo (Node.js, TypeScript, Vite e Knex), na definição do workflow do GitHub Actions para os três sistemas operacionais e na revisão de erros pontuais de integração durante os testes.

## Execução dos testes

### Pré-requisitos

- Node.js 22.x ou 24.x
- npm 11.x

### Testes de unidade e cobertura no backend

```bash
cd backend
npm install
npm test
npm run test:coverage
```

O ambiente de teste do backend executa as migrations automaticamente em um banco SQLite separado (`db/test.db`) antes da suíte e reverte ao final. Atualmente o backend conta com 84 testes automatizados e cobertura acima de 95%.

### Testes de unidade e cobertura no frontend

```bash
cd frontend
npm install
npm test
npm run test:coverage
```

Os testes do frontend utilizam MSW para interceptar as chamadas da API sem depender do backend rodando. Atualmente o frontend conta com 51 testes automatizados e cobertura acima de 93%.

### Testes end-to-end (Cypress)

Os testes end-to-end validam os fluxos completos com o backend e o frontend rodando localmente.

1. Em um terminal, configure o banco e inicie o backend:

```bash
cd backend
cp .env.example .env
npm run knex -- migrate:latest
npm run knex -- seed:run
npm run dev
```

2. Em um segundo terminal, inicie o frontend:

```bash
cd frontend
npm run dev
```

3. Em um terceiro terminal, execute os 5 testes E2E no Cypress:

```bash
cd frontend
npm run cypress:run
```
