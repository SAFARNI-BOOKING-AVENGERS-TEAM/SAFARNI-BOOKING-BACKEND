
import { JwtPayload } from 'jsonwebtoken';
import { IUser } from './../DB/models/user.model';
import { Request } from "express";

//create a custom interface named 'IRequest' that inherits (extends) all standard features of the Express Request.
export interface IRequest extends Request{
    credentials?:{
        user?:IUser,
        decoded:JwtPayload
    }
}