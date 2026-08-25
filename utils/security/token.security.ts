import { IUser } from "./../../DB/models/user.model";
import jwt, { JwtPayload, Secret, SignOptions } from "jsonwebtoken";
import { Types } from "mongoose";
import UserModel from "../../DB/models/user.model";
import { NotFoundException, UnAuthorizedException } from "../response/error.response";

export enum TokenType {
  access = "access",
  refresh = "refresh",
}

const accessExpiresIn = (
  process.env.NODE_ENV === "development"
    ? process.env.ACCESS_TOKEN_EXPIRES_DEVELOPMENT
    : process.env.ACCESS_TOKEN_EXPIRES
) as SignOptions["expiresIn"];

const refreshExpiresIn = process.env.REFRESH_TOKEN_EXPIRES as SignOptions["expiresIn"];

export const generateTokens = (
  userId: Types.ObjectId,
  refreshTokenVersion: number = 0
): { access_token: string; refresh_token: string } => {
  const accessSecret = process.env.ACCESS_TOKEN_SECRET as Secret;
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET as Secret;

  if (!accessSecret || !refreshSecret) {
    throw new UnAuthorizedException("Token secrets are missing");
  }

  const access_token = jwt.sign({ _id: userId }, accessSecret, { expiresIn: accessExpiresIn });
  const refresh_token = jwt.sign({ _id: userId, v: refreshTokenVersion }, refreshSecret, { expiresIn: refreshExpiresIn });
  return { access_token, refresh_token };
};

export const verifyToken = async (
  token: string,
  type: TokenType = TokenType.access
): Promise<{ decoded: JwtPayload; user: IUser }> => {
  const secret = type === TokenType.refresh
    ? (process.env.REFRESH_TOKEN_SECRET as Secret)
    : (process.env.ACCESS_TOKEN_SECRET as Secret);

  if (!secret) throw new UnAuthorizedException("Token secret is missing");

  let decoded: JwtPayload;
  try {
    decoded = jwt.verify(token, secret) as JwtPayload;
  } catch {
    throw new UnAuthorizedException("Invalid or expired token");
  }

  if (!decoded?._id || !decoded?.iat) {
    throw new UnAuthorizedException("Invalid token payload");
  }

  const user = await UserModel.findById(decoded._id).select("+refreshTokenVersion");
  if (!user) throw new NotFoundException("Invalid User Id decoded from token");

  return { user, decoded };
};
