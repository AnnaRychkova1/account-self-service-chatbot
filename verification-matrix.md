# Verification Matrix

This matrix maps the main challenge requirements and acceptance scenarios to
their implementation and automated test coverage.

| #   | Requirement / Scenario                                                             | Implementation                                                                                               | Automated Verification                             |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| 1   | Read account details without modifying data or sending a notification              | `src/lib/chat/handlers/chat-read.ts`, `src/lib/account/services/account-get.ts`                              | Account and chat action tests                      |
| 2   | Update account-holder phone number and other mutable account-holder fields         | `src/lib/chat/handlers/chat-update.ts`, `src/lib/account/services/account-update.ts`                         | Account update and chat action tests               |
| 3   | Validate account-holder updates before persistence                                 | `src/lib/account/services/account-update.ts`                                                                 | Account update validation tests                    |
| 4   | Preserve a pending action and complete it from a follow-up message                 | `src/app/api/chat/route.ts`, `src/lib/chat/parser.ts`, `src/lib/chat/prompt.ts`, `src/lib/chat/actions.ts`   | Chat parser, route, and acceptance tests           |
| 5   | Add an authorized related person                                                   | `src/lib/chat/handlers/chat-related-people.ts`, `src/lib/account/services/related-people.ts`                 | Related-person and acceptance tests                |
| 6   | Ask for missing related-person information before writing data                     | `src/lib/chat/parser.ts`, `src/lib/chat/prompt.ts`, `src/lib/chat/handlers/chat-related-people.ts`           | Chat parser, related-person, and acceptance tests  |
| 7   | Update a related person and handle ambiguous matches safely                        | `src/lib/chat/handlers/chat-related-people.ts`, `src/lib/account/services/related-people.ts`                 | Related-person workflow tests                      |
| 8   | Remove and view related people                                                     | `src/lib/chat/handlers/chat-related-people.ts`, `src/lib/account/services/related-people.ts`                 | Related-person workflow tests                      |
| 9   | Create and view a one-time promise to pay                                          | `src/lib/chat/handlers/chat-promise-to-pay.ts`, `src/lib/account/services/promise-to-pay.ts`                 | Promise-to-pay and acceptance tests                |
| 10  | Validate promise amount and future due date                                        | `src/lib/account/services/promise-to-pay.ts`                                                                 | Promise-to-pay validation tests                    |
| 11  | Process a mocked payment using saved payment details                               | `src/lib/chat/handlers/chat-payment.ts`, `src/lib/account/services/payment.ts`                               | Payment and acceptance tests                       |
| 12  | Atomically record a payment transaction and reduce the account balance             | `src/lib/account/services/payment.ts`                                                                        | Payment service and acceptance tests               |
| 13  | Prevent invalid, over-balance, or duplicate payment requests                       | `src/lib/account/services/payment.ts`                                                                        | Payment validation and idempotency tests           |
| 14  | Return seeded and newly created transaction history                                | `src/lib/chat/handlers/chat-read.ts`, `src/lib/account/services/account-get.ts`                              | Transaction and chat read tests                    |
| 15  | Book a future call appointment                                                     | `src/lib/chat/handlers/chat-call-appointment.ts`, `src/lib/account/services/call-appointment.ts`             | Call-appointment and acceptance tests              |
| 16  | Reject past call appointments and request a future date/time                       | `src/lib/chat/handlers/chat-call-appointment.ts`, `src/lib/account/services/call-appointment.ts`             | Call-appointment and acceptance tests              |
| 17  | View scheduled call appointments                                                   | `src/lib/chat/handlers/chat-read.ts`, `src/lib/account/services/account-get.ts`                              | Call-appointment and chat read tests               |
| 18  | Parse user messages into constrained structured actions                            | `src/lib/chat/parser.ts`, `src/lib/chat/prompt.ts`                                                           | Chat parser tests                                  |
| 19  | Validate LLM output and retry malformed JSON once                                  | `src/lib/chat/parser.ts`                                                                                     | Chat parser tests                                  |
| 20  | Keep the LLM outside database writes and business side effects                     | `src/lib/chat/parser.ts`, `src/lib/chat/actions.ts`, `src/lib/chat/handlers/*`, `src/lib/account/services/*` | Parser, handler, service, and acceptance tests     |
| 21  | Generate an account-summary PDF after persisted changes                            | `src/lib/notifications/account-summary-pdf.ts`                                                               | Account-summary PDF tests                          |
| 22  | Encrypt the PDF using the last four digits of the current account phone number     | `src/lib/notifications/account-summary-pdf.ts`                                                               | PDF password and generation tests                  |
| 23  | Send a generic account-change email through Resend with the encrypted PDF attached | `src/lib/notifications/account-change-notification.ts`                                                       | Notification tests with mocked external boundaries |
| 24  | Avoid sensitive account details in the notification email body                     | `src/lib/notifications/account-change-notification.ts`                                                       | Notification content tests                         |
| 25  | Record notification attempts and delivery status in Supabase                       | `src/lib/notifications/account-change-notification.ts`                                                       | Notification persistence tests                     |
| 26  | Return a complete account summary when no specific account field is requested      | `src/lib/chat/handlers/chat-read.ts`, `src/lib/account/services/account-get.ts`                              | Account read and summary tests                     |

## Acceptance Contracts

The starter acceptance contracts are implemented in the acceptance test suite
and cover:

- updating the account-holder phone number and queuing a notification;
- adding an authorized related person;
- completing a pending action using details supplied in a follow-up turn;
- recording a one-time promise to pay;
- recording a mocked payment and reducing the account balance;
- booking a future call appointment and rejecting a past appointment.

## Cross-Cutting Verification

The focused unit, handler, parser, and acceptance tests also verify:

- business validation occurs before persistence;
- malformed or unsupported LLM output cannot directly perform side effects;
- pending conversation state is preserved for incomplete actions;
- ambiguous related-person matches are not guessed;
- duplicate mocked payments are handled safely;
- payment balance and transaction changes remain consistent;
- notification failures are observable without exposing sensitive account data;
- external notification boundaries are mocked in automated tests;
- notification email content remains generic;
- sensitive account information is placed in the encrypted PDF attachment.

## Final Verification

Before submission, the project is verified with:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
