import { Resend } from "resend";
import { PRODUCT_NAME } from "@/lib/product-tagline";

const FROM_EMAIL =
  process.env.CONTACT_FROM_EMAIL ?? `${PRODUCT_NAME} <onboarding@resend.dev>`;

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not configured");
  }
  return new Resend(apiKey);
}

export async function sendEmail(args: {
  to: string[];
  subject: string;
  html: string;
  replyTo?: string[];
}): Promise<{ id?: string }> {
  const resend = getResendClient();
  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: args.to,
    subject: args.subject,
    html: args.html,
    ...(args.replyTo && args.replyTo.length > 0 ? { replyTo: args.replyTo } : {}),
  });
  if (error) {
    throw new Error(error.message || "Failed to send email");
  }
  return { id: data?.id };
}

export function getDefaultFromEmail(): string {
  return FROM_EMAIL;
}
