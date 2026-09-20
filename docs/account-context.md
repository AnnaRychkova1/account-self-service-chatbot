# Account Context

The application uses a structured account context to represent the account holder, account details, related people, promises to pay, transactions, and call appointments.

The account context is loaded from Supabase and mapped into the application's domain model before being used by chat workflows and business services.

## Mutable Fields

The following account data can be read and updated through the application:

- account holder name
- account holder email
- account holder phone
- account holder address
- preferred contact method
- related people
- promises to pay
- transactions created by mocked payments
- call appointments
- current account balance after mocked payments

## Read-Only Fields

The following account fields are treated as read-only:

- account reference
- creditor name
- account status
- days past due
- billing due date
- support phone and email
- seeded historical transactions

## Legacy Fixture Fields

The JSON fixtures contain legacy field names such as `debtorFirstName` and `debtorLastName`.

The application maps these fields to `accountHolderFirstName` and `accountHolderLastName` in the domain model so that the application code consistently uses account holder terminology.

## Notifications

After a successful account data change, the application can send a generic notification email through Resend with an encrypted PDF account summary.

Sensitive account details are kept out of the email body and included only in the encrypted PDF attachment.

Notification delivery is isolated behind a service boundary and mocked in automated tests.
