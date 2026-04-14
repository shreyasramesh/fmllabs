import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { sendEmail } from "@/lib/mail";
import { PRODUCT_NAME } from "@/lib/product-tagline";

const TO_EMAIL = "shreyas.ramesh@gmail.com";

export async function POST(request: Request) {
  try {
    const user = await currentUser();
    const body = await request.json();
    const { message, email: bodyEmail, type } = body as { message?: string; email?: string; type?: string };

    const trimmedMessage = typeof message === "string" ? message.trim() : "";
    if (!trimmedMessage) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    let senderEmail: string;
    if (user?.primaryEmailAddress?.emailAddress) {
      senderEmail = user.primaryEmailAddress.emailAddress;
    } else {
      senderEmail = typeof bodyEmail === "string" ? bodyEmail.trim() : "";
    }

    if (!senderEmail) {
      return NextResponse.json(
        { error: "Sign in to use your account email, or provide your email in the form" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(senderEmail)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return NextResponse.json({ error: "Contact form is not configured" }, { status: 503 });
    }

    const result = await sendEmail({
      to: [TO_EMAIL],
      replyTo: [senderEmail],
      subject: type === "feedback"
      ? `${PRODUCT_NAME} feedback from ${senderEmail}`
      : `${PRODUCT_NAME} contact from ${senderEmail}`,
      html: `
        <p><strong>From:</strong> ${senderEmail}</p>
        <p><strong>Message:</strong></p>
        <p>${trimmedMessage.replace(/\n/g, "<br>")}</p>
      `,
    });
    return NextResponse.json({ success: true, id: result.id });
  } catch (err) {
    console.error("Contact API error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
