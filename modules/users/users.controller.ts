import { authMiddleware } from "./../../middleware/auth.middleware";
import { Router } from "express";
import * as usersService from "./users.service";

export const usersRouter = Router();

usersRouter.get("/my-profile", authMiddleware, usersService.myProfile);
