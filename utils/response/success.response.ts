import { Response } from 'express';

interface SuccessResponseParams {
  res: Response;
  statusCode?: number;
  message?: string;
  info?: string | object;
  data?: any;
  pagination?: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
}

export const successResponse = ({ res, statusCode = 200, message = 'Done', info, data, pagination }: SuccessResponseParams): Response => {
  return res.status(statusCode).json({
    message,
    info,
    statusCode,
    data,
    ...(pagination && { pagination }),
  });
};