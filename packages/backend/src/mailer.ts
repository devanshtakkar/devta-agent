import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "./env.js";

export const transporter: Transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
  },
});

export interface SendMailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export async function sendMail(options: SendMailOptions) {
  const { to, subject, html, text, from } = options;
  return transporter.sendMail({
    from: from ?? env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
  });
}
