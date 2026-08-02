import { encryptPDF } from "@pdfsmaller/pdf-encrypt";
import { PDFDocument, StandardFonts } from "pdf-lib";

import type { AccountContext } from "@/lib/account/types";

export function getAccountPdfPassword(accountContext: AccountContext): string {
  const DIGITS = accountContext.account.phone.replace(/\D/g, "");

  if (DIGITS.length < 4) {
    throw new Error("Account phone number cannot be used as the PDF password.");
  }

  return DIGITS.slice(-4);
}

export async function generateAccountSummaryPdf(
  accountContext: AccountContext,
): Promise<Buffer> {
  const PDF_DOCUMENT = await PDFDocument.create();
  const FONT = await PDF_DOCUMENT.embedFont(StandardFonts.Helvetica);
  const BOLD_FONT = await PDF_DOCUMENT.embedFont(StandardFonts.HelveticaBold);

  PDF_DOCUMENT.setTitle("Account Summary");
  PDF_DOCUMENT.setSubject("Account change summary");

  let PAGE = PDF_DOCUMENT.addPage([595.28, 841.89]);
  let Y = 790;

  const ACCOUNT = accountContext.account;

  const ensureSpace = (height = 24) => {
    if (Y >= 60 + height) {
      return;
    }

    PAGE = PDF_DOCUMENT.addPage([595.28, 841.89]);
    Y = 790;
  };

  const addHeading = (text: string) => {
    ensureSpace(30);

    PAGE.drawText(text, {
      x: 50,
      y: Y,
      size: 14,
      font: BOLD_FONT,
    });

    Y -= 24;
  };

  const addLine = (text: string) => {
    const FONT_SIZE = 10;
    const LINE_HEIGHT = 14;
    const MAX_WIDTH = 495;

    const LINES = wrapText(text, FONT, FONT_SIZE, MAX_WIDTH);
    const REQUIRED_HEIGHT = LINES.length * LINE_HEIGHT;

    ensureSpace(REQUIRED_HEIGHT);

    for (const LINE of LINES) {
      PAGE.drawText(LINE, {
        x: 50,
        y: Y,
        size: FONT_SIZE,
        font: FONT,
      });

      Y -= LINE_HEIGHT;
    }
  };
  PAGE.drawText("Account Summary", {
    x: 50,
    y: Y,
    size: 20,
    font: BOLD_FONT,
  });

  Y -= 36;

  addHeading("Account holder");
  addLine(
    `Name: ${ACCOUNT.accountHolderFirstName} ${ACCOUNT.accountHolderLastName}`,
  );
  addLine(`Email: ${ACCOUNT.email}`);
  addLine(`Phone: ${ACCOUNT.phone}`);
  addLine(`Address: ${formatAddress(accountContext)}`);
  addLine(
    `Preferred contact method: ${formatContactMethod(
      ACCOUNT.preferredContactMethod,
    )}`,
  );

  Y -= 12;

  addHeading("Account");
  addLine(`Reference: ${ACCOUNT.reference}`);
  addLine(`Creditor: ${ACCOUNT.creditorName}`);
  addLine(`Status: ${ACCOUNT.status}`);
  addLine(`Days past due: ${ACCOUNT.daysPastDue}`);
  addLine(
    `Current balance: ${formatCurrency(
      ACCOUNT.balanceCents,
      ACCOUNT.currency,
    )}`,
  );

  Y -= 12;

  addHeading("Related people");

  if (accountContext.relatedPeople.length === 0) {
    addLine("None");
  } else {
    for (const PERSON of accountContext.relatedPeople) {
      addLine(
        [
          PERSON.name,
          PERSON.relationship ? `Relationship: ${PERSON.relationship}` : null,
          `Email: ${PERSON.email}`,
          `Phone: ${PERSON.phone}`,
          `Authorized to act: ${PERSON.authorizedToAct ? "Yes" : "No"}`,
        ]
          .filter(Boolean)
          .join(" | "),
      );
    }
  }

  Y -= 12;

  addHeading("Promises to pay");

  if (accountContext.promisesToPay.length === 0) {
    addLine("None");
  } else {
    for (const PROMISE of accountContext.promisesToPay) {
      addLine(
        `${formatCurrency(
          PROMISE.amountCents,
          PROMISE.currency,
        )} due ${PROMISE.dueDate} | Status: ${PROMISE.status}`,
      );
    }
  }

  Y -= 12;

  addHeading("Transactions");

  if (accountContext.transactions.length === 0) {
    addLine("None");
  } else {
    for (const TRANSACTION of accountContext.transactions) {
      addLine(
        `${TRANSACTION.transactionDate} | ${TRANSACTION.type} | ${formatCurrency(
          TRANSACTION.amountCents,
          TRANSACTION.currency,
        )} | ${TRANSACTION.status} | ${TRANSACTION.description}`,
      );
    }
  }

  Y -= 12;

  addHeading("Call appointments");

  if (accountContext.callAppointments.length === 0) {
    addLine("None");
  } else {
    for (const APPOINTMENT of accountContext.callAppointments) {
      addLine(
        [
          formatDateTime(APPOINTMENT.scheduledAt),
          `Phone: ${APPOINTMENT.phone}`,
          APPOINTMENT.reason ? `Reason: ${APPOINTMENT.reason}` : null,
          `Status: ${APPOINTMENT.status}`,
        ]
          .filter(Boolean)
          .join(" | "),
      );
    }
  }

  const PDF_BYTES = await PDF_DOCUMENT.save();

  return Buffer.from(PDF_BYTES);
}

export async function generateEncryptedAccountSummaryPdf(
  accountContext: AccountContext,
): Promise<Buffer> {
  const PASSWORD = getAccountPdfPassword(accountContext);
  const PDF = await generateAccountSummaryPdf(accountContext);

  return encryptAccountSummaryPdf(PDF, PASSWORD);
}

async function encryptAccountSummaryPdf(
  pdf: Buffer,
  password: string,
): Promise<Buffer> {
  const ENCRYPTED_PDF = await encryptPDF(new Uint8Array(pdf), password, {
    algorithm: "AES-256",
    ownerPassword: password,
    allowPrinting: true,
  });

  return Buffer.from(ENCRYPTED_PDF);
}

function wrapText(
  text: string,
  font: {
    widthOfTextAtSize: (text: string, size: number) => number;
  },
  fontSize: number,
  maxWidth: number,
): string[] {
  const WORDS = text.split(/\s+/);
  const LINES: string[] = [];

  let CURRENT_LINE = "";

  for (const WORD of WORDS) {
    const NEXT_LINE = CURRENT_LINE ? `${CURRENT_LINE} ${WORD}` : WORD;

    if (font.widthOfTextAtSize(NEXT_LINE, fontSize) <= maxWidth) {
      CURRENT_LINE = NEXT_LINE;
      continue;
    }

    if (CURRENT_LINE) {
      LINES.push(CURRENT_LINE);
    }

    CURRENT_LINE = WORD;
  }

  if (CURRENT_LINE) {
    LINES.push(CURRENT_LINE);
  }

  return LINES;
}

function formatAddress(accountContext: AccountContext): string {
  const ADDRESS = accountContext.account.address;

  return [
    ADDRESS.line1,
    ADDRESS.line2,
    ADDRESS.city,
    ADDRESS.postalCode,
    ADDRESS.country,
  ]
    .filter(Boolean)
    .join(", ");
}

function formatCurrency(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

function formatContactMethod(method: string): string {
  return method === "sms" ? "SMS" : method;
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-IE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Dublin",
  }).format(new Date(value));
}
