import { authMiddleware } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/admin.middleware";
import { Router } from "express";
import * as usersService from "./users.service";
import { upload } from "../../middleware/upload";
import { asyncHandler } from "../../utils/response/async.handler";

export const usersRouter = Router();

usersRouter.get(
  "/my-profile",
  authMiddleware,
  asyncHandler(usersService.myProfile)
);

usersRouter.post(
  "/upload-profile-picture",
  authMiddleware,
  upload.single("image"),
  asyncHandler(usersService.updateProfilePicture)
);

usersRouter.patch(
  "/update-profile-info",
  authMiddleware,
  asyncHandler(usersService.updateProfileInfo)
);