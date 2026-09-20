# Design Note

## Architecture and Data Model

The application uses a layered architecture that separates natural-language interpretation from business logic and persistence.

User messages are sent to the Next.js `/api/chat` endpoint and parsed by OpenRouter into a structured action containing an action name, fields, and missing fields. The LLM is used only for message interpretation. It cannot access Supabase directly or perform account changes.

Structured actions are validated and passed through the action router to dedicated chat handlers and account services. Business rules and input validation are enforced before persistence. Supabase is accessed only server-side.

The Supabase data model stores the account holder and associated related people, promises to pay, transactions, call appointments, and notification attempts. Existing account fields such as reference, creditor, status, and historical transactions remain read-only.

Multi-turn requests are supported using pending action state. When required information is missing, the application preserves the action and collected fields and asks the user for the remaining information before executing the operation.

## Payments and Consistency

Payments are mocked and do not use a real payment provider. A successful payment creates a transaction and reduces the account balance.

Payment persistence is performed through a single Supabase RPC operation so that the payment transaction and balance update remain consistent. Each payment request includes a request identifier used for idempotency, allowing repeated requests to return the existing result instead of creating an additional payment.

Invalid, malformed, zero, negative, and over-balance payment amounts are rejected before a successful payment is recorded.

## Notifications

Successful persisted changes trigger an account-change notification.

The notification email contains only generic text and does not expose sensitive account information. The current account summary is generated as a PDF and encrypted using the last four digits of the account holder's current phone number as the password.

Email delivery uses Resend. Notification attempts are recorded in Supabase with their delivery status so failures remain observable. Notification delivery is treated separately from the account mutation: a notification failure does not undo an already successful account change.

External notification delivery is mocked in automated tests, while PDF generation is tested independently. Chat action tests mock the notification boundary so the test suite does not depend on a real inbox or external delivery.

## Failure Modes and Trade-offs

LLM output is treated as untrusted input. Responses are runtime-validated before routing, and invalid JSON is retried once before the request fails safely. Unsupported actions cannot directly trigger business operations.

Ambiguous or incomplete requests are not guessed. The chatbot asks for clarification and preserves pending context where appropriate.

The application intentionally uses deterministic services for validation and side effects rather than allowing the LLM to perform operations. This adds some routing and mapping code but keeps account changes predictable and testable.

The implementation uses a mocked payment workflow because integration with a real payment provider is outside the scope of this project.

## Security and Identity

Secrets for Supabase, OpenRouter, and Resend are stored in environment variables and are not committed to the repository.

Database operations, notification delivery, and PDF generation are performed server-side. Sensitive account details are excluded from notification email bodies and placed in the encrypted PDF attachment instead.

Account access is tied to an authenticated Supabase user. The server resolves the current account from the authenticated user's identity rather than accepting an account identifier from the browser. Row Level Security policies provide an additional database-level boundary so an authenticated user cannot read or modify another account's data.

## Monitoring and Next Steps

The application records notification attempts and safely surfaces service failures through server-side errors and logs.

For production use, the next steps would include stronger authorization for representatives, structured application monitoring, retry handling for failed notifications, rate limiting, and integration with a real payment provider.
