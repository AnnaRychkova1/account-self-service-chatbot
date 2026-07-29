# Account Self-Service Chatbot

## Project Setup

This project will be implemented incrementally using small, focused commits. Each commit should represent a complete, reviewable piece of work while keeping the application in a working state.

The chatbot follows a layered architecture. The LLM is responsible only for parsing user messages into structured actions. It never writes directly to the database or performs business operations.

---

## Architecture

The application follows a layered architecture that separates message parsing, business logic, data access, and external integrations.

```text
                         User
                           │
                           ▼
                    Chat Interface
                           │
                           ▼
                       Chat API
                           │
                           ▼
                      LLM Parser
                           │
                           ▼
                    Action Router
                           │
                           ▼
                  Business Services
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
  Account Workflows  Payment Service  Notification Service
          │                │           ┌────┼──────────┐
          │                │           ▼    ▼          │
          │                │     PDF Generator       Resend
          │                │                         │
          └────────────────┴──────────────┬──────────┘
                                         ▼
                              Server-side Supabase Client
                                         │
                                         ▼
                                      Supabase
```

### Design Principles

- The LLM is responsible only for converting user messages into structured actions.
- The action router delegates each structured action to the appropriate business service.
- Business services contain validation and business rules.
- Business services access Supabase through the server-side Supabase client.
- Mock payments are processed through the payment service and persisted in Supabase.
- Account-change notifications generate an encrypted PDF and send it through Resend.
- Notification attempts are recorded in Supabase.
- External services are mocked in automated tests.
- The LLM never performs database operations, payments, or notifications directly.

---

## Planned Commits

## 1. Configure local development and project setup

**Commit**

`chore: configure local development and project setup`

- Review the starter project structure.
- Install project dependencies.
- Add `IMPLEMENTATION.md`.
- Configure the local environment.
- Verify the application builds and runs successfully.

#### Notes

- Configured OpenAI, Resend, and Supabase environment variables.

---

## 2. Configure initial deployment

**Commit**

`chore: configure initial deployment`

- Connect the project to Vercel.
- Configure the required production environment variables.
- Deploy the starter application.
- Verify the production deployment.

#### Notes

- Deployment only (no commit).

---

## 3. Implement Supabase persistence (read operations)

**Commit**

`feat: implement account persistence with Supabase`

- Configure the Supabase project.
- Run the provided database migration.
- Implement the server-side Supabase client.
- Load the complete `AccountContext`.
- Implement account read operations.
- Add unit tests for account data loading.

#### Notes

- Introduced a mapper to convert Supabase records into the `AccountContext` domain model.

---

## 4. Implement account holder actions

**Commit**

`feat: implement account holder actions`

- Update account holder information.
- Validate account holder data.
- Persist changes to Supabase.
- Return the updated account context
- Add unit tests for account holder actions.

#### Notes

- Centralized account holder validation and field mapping.
- Added comprehensive offline unit tests covering success, validation, and error scenarios.

---

## 5. Implement chatbot and conversation flow

**Commit**

`feat: implement chatbot conversation flow`

- Connect OpenAI.
- Parse user messages into structured actions.
- Implement the action router.
- Support multi-turn conversations.
- Validate all LLM output.
- Mock OpenAI in tests.

---

## 6. Implement related people actions

**Commit**

`feat: implement related people actions`

- Read, add, update, and remove related people.
- Validate user input.
- Handle missing and ambiguous information.
- Persist related people changes in Supabase.
- Add unit tests for related people workflows.

---

## 7. Implement promise-to-pay workflow

**Commit**

`feat: implement promise-to-pay workflow`

- Create and view promises to pay.
- Validate payment amounts and future dates.
- Handle missing information.
- Persist promises to pay in Supabase.
- Add workflow tests.

---

## 8. Implement mocked payments

**Commit**

`feat: implement mocked payments and transaction history`

- Create mocked payment transactions.
- Update the account balance atomically.
- Display transaction history.
- Prevent invalid or duplicate payment requests.
- Persist transactions and balance changes in Supabase.
- Add payment tests.

---

## 9. Implement call appointments

**Commit**

`feat: implement call appointment booking`

- Book future call appointments.
- View scheduled appointments.
- Validate appointment dates and times.
- Persist appointments in Supabase.
- Add appointment tests.

---

## 10. Implement account-change notifications

**Commit**

`feat: send account-change notifications`

- Generate an encrypted account summary PDF.
- Send notification emails through Resend.
- Record notification attempts in Supabase.
- Mock PDF generation and Resend in tests.
- Add notification tests.

---

## 11. Complete acceptance tests

**Commit**

`test: complete acceptance test coverage`

- Complete all required acceptance scenarios.
- Cover validation and failure paths.
- Keep tests deterministic and offline.
- Verify the complete application workflow.

---

## 12. Finalize documentation and deployment

**Commit**

`docs: finalize documentation`

- Update the README.
- Document the architecture and design decisions.
- Add deployment information.
- Perform a final verification before submission.

---

## Checks Before Each Commit

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

The implementation plan may evolve during development, but each commit should remain focused, tested, and easy to review.
