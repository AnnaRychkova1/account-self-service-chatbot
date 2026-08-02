# Architecture Diagram

The application separates natural-language interpretation from deterministic business logic and side effects. The LLM produces structured actions only and never writes directly to the database.

```mermaid
flowchart TD
    User["Account Holder"] --> UI["Next.js Chat Interface"]
    UI --> API["POST /api/chat"]

    API --> Parser["OpenRouter LLM Parser"]
    Parser --> Validation["Structured Action Validation"]
    Validation --> Router["Action Router"]

    Router --> Account["Account Holder Handler"]
    Router --> Related["Related People Handler"]
    Router --> Promise["Promise-to-Pay Handler"]
    Router --> Payment["Mock Payment Handler"]
    Router --> Appointment["Call Appointment Handler"]

    Account --> Services["Account Services"]
    Related --> Services
    Promise --> Services
    Payment --> Services
    Appointment --> Services

    Services --> Supabase["Supabase"]

    Services --> Notification["Account Change Notification"]
    Notification --> PDF["Account Summary PDF"]
    PDF --> Encryption["AES-256 PDF Encryption"]
    Encryption --> Resend["Resend Email"]

    Notification --> Attempts["Notification Attempts"]
    Attempts --> Supabase

    Supabase --> Services
    Services --> Router
    Router --> API
    API --> UI
```

## Key Boundaries

- **LLM parser:** converts free-text messages into structured actions and fields.
- **Validation and routing:** validates LLM output before any business operation is executed.
- **Business services:** enforce deterministic validation and persistence rules.
- **Supabase:** stores account data, related people, promises, transactions, appointments, balances, and notification attempts.
- **Mock payments:** update the transaction history and account balance atomically and use request IDs to protect against duplicate processing.
- **Notification service:** runs after successful persisted changes and records delivery attempts.
- **PDF generation:** creates the current account summary and encrypts it using the last four digits of the current account phone number.
- **Resend:** sends a generic email containing no sensitive account details, with the encrypted PDF attached.
