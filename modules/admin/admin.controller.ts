import { Router } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/admin.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import * as usersService from "../users/users.service";

const adminRouter = Router();

// Admin can change a user's role
// PATCH /admin/users/:id/role
adminRouter.patch(
  "/users/:id/role",
  authMiddleware,
  authorizeRoles("admin"),
  asyncHandler(usersService.updateUserRole)
);

export default adminRouter;