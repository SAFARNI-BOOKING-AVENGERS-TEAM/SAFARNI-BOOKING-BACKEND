import { JwtPayload } from "jsonwebtoken";
import { Request } from "express";
import { IUser } from "../DB/models/user.model";

export interface IRequest extends Request {
  credentials?: {
    user: IUser;
    decoded: JwtPayload;
  };
}
