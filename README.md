# Account Self-Service Chatbot

A portfolio project based on a technical challenge involving secure self-service workflows for customers with overdue accounts.

The application uses Next.js, TypeScript, Supabase, OpenRouter, and Resend to turn free-text requests into validated account actions.

Key areas include:

- server-side account identity and Row Level Security
- deterministic validation and business rules
- multi-turn chat workflows
- idempotent mocked payments
- account-change notifications with encrypted PDF summaries
- automated unit and integration testing

## Live Demo

https://account-self-service-chatbot-two.vercel.app/

## Demo Access

Use the following demo account to explore the application:

- Email: `demo@example.com`
- Password: `Demo12345!`

This account contains seeded test data for exploring the self-service workflows.

The demo account is isolated from other accounts through Supabase Row Level Security.

## Features

### Account details

- Read and update name, email, phone number, postal address, and preferred contact method.
- Validate account changes before persistence.
- Support email, SMS, and phone as preferred contact methods.

### Related people

- Add, update, remove, and view related people.
- Store contact details and authorization status.
- Ask for missing information instead of guessing.

### Promise to pay

- Create and view one-time promises to pay.
- Validate the amount and future due date.

### Mocked payments

- Record mocked payments and update the persisted balance atomically.
- Maintain consistent transaction history.
- Handle repeated payment requests safely.
- Reject invalid and over-balance payments.

### Call appointments

- Book and view future calls.
- Capture date, time, phone number, and reason.
- Reject appointments in the past.

### Notifications

After successful account changes, the application can send a generic notification email through Resend with an encrypted PDF account summary.
The PDF is encrypted using the last four digits of the account holder's current phone number as the password.

Sensitive account details are kept out of the email body. Notification failures are recorded without storing sensitive email or PDF content.

## Security

The application uses Supabase Auth and Row Level Security to establish the account identity boundary.

The browser does not choose which account is being operated on. The server resolves the account from the authenticated Supabase user and applies the same identity boundary to account-related operations.

RLS policies prevent an authenticated user from reading or modifying another user's account data.

The repository includes integration tests covering:

- reading only the authenticated user's account
- preventing access to another user's account
- preventing cross-account updates

Run the RLS integration tests separately with:

```bash
RLS_INTEGRATION=true pnpm vitest run src/lib/__tests__/rls-isolation.integration.test.ts
```

## Testing

The normal test suite is designed to run without live provider credentials or network access.

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The project also contains a separate Supabase integration test suite for account-isolation checks.

## Local development

Install dependencies:

```bash
pnpm i
```

Create the local environment file:

```bash
cp .env.example .env.local
```

Start the development server:

```bash
pnpm dev
```

The application will be available at `http://localhost:3000`.

Add the required Supabase, Resend, and OpenRouter configuration for the features you want to run locally.

Never commit `.env.local` or real API credentials.

## Project structure

```text
src/app/                 Next.js application and API routes
src/components/          UI components
src/lib/account/         Account and business services
src/lib/auth/            Server-side authentication helpers
src/lib/chat/            Chat contracts and services
src/lib/notifications/   Email and PDF notification boundary
src/lib/supabase/        Supabase client configuration
supabase/migrations/     Database schema and security policies
docs/                    Scenarios and supporting documentation
```

## Documentation

- [Architecture diagram](./architecture-diagram.md)
- [Verification matrix](./verification-matrix.md)
- [Design note](./design-note.md)
- [Acceptance scenarios](./docs/scenarios.md)
- [Account context](./docs/account-context.md)
