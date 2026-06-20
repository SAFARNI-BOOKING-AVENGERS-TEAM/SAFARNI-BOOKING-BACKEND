export interface EmailOptions {
  email: string;
  subject: string;
  message: string;
  html?: string;
}

export type EmailTemplate = Omit<EmailOptions, "email">;