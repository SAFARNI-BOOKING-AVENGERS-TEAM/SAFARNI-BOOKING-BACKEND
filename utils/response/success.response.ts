import { Response } from 'express';

interface SuccessResponseParams {
  res: Response;
  statusCode?: number;
  message?: string;
  info?: string | object;
  data?: any;
}

export const successResponse = ({ res, statusCode = 200, message = 'Done', info, data }: SuccessResponseParams): Response => {
  return res.status(statusCode).json({
    message,
    info,
    statusCode,
    data,
  });
};
