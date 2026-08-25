import { EmailTemplate } from "./email.types";

export const getVerifyEmailTemplate = (url: string): EmailTemplate => ({
  subject: "Verify your email address",
  message: `Verify your email here: ${url}`,
  html: `
    <div style="font-family: sans-serif; border: 1px solid #eee; padding: 20px;">
      <h2>Welcome to Safarni!</h2>
      <p>Please verify your email address to activate your account:</p>
      <a href="${url}" style="background: blue; color: white; padding: 10px;">Verify Email</a>
      <p style="color: #888; font-size: 12px; margin-top: 20px;">This link expires in 24 hours.</p>
    </div>
  `,
});