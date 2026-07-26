import { Response } from 'express';

const isProduction = process.env.NODE_ENV === 'production';

export const setTokenCookie = (
  res: Response,
  credentials: {
    access_token: string;
    refresh_token: string;
  },
) => {
  res.cookie('access_token', credentials.access_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge:
      process.env.NODE_ENV === 'development'
        ? 24 * 60 * 60 * 1000
        : 60 * 60 * 1000,
  });
  res.cookie('refresh_token', credentials.refresh_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export const clearTokenCookie = (res: Response) => {
  res.clearCookie('access_token', { httpOnly: true, sameSite: 'lax', secure: isProduction });
  res.clearCookie('refresh_token', { httpOnly: true, sameSite: 'lax', secure: isProduction });
};