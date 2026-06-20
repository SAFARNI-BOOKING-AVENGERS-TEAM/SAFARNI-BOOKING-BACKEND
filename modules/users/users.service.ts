import { IRequest } from "../../types/request.types";
import { successResponse } from "./../../utils/response/success.response";
import {  Response } from "express";

export const myProfile = async (req: IRequest, res: Response) => {
  return successResponse({
    res,
    data:req.credentials?.user
  });
};