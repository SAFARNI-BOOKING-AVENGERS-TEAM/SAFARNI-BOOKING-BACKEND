import { EmailOptions, EmailTemplate } from "./email.types";

export const getResetPasswordTemplate = (url: string): EmailTemplate => ({
  subject: "Password Reset Request",
  message: `Reset your password here: ${url}`,
  html: `
    <div style="font-family: sans-serif; border: 1px solid #eee; padding: 20px;">
      <h2>Password Reset</h2>
      <p>You requested a password reset. Click the button below:</p>
      <a href="${url}" style="background: blue; color: white; padding: 10px;">Reset Password</a>
    </div>
  `,
});
