import { Router, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/admin.middleware";
import { optionalAuthMiddleware } from "../../middleware/optionalAuth.middleware";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { successResponse } from "../../utils/response/success.response";
import { requireProviderType } from "../../middleware/providerType.middleware";
import { BadRequestException } from "../../utils/response/error.response";
import {
  CreateESIMPlanSchema,
  UpdateESIMPlanSchema,
  UpdateESIMPlanStatusSchema,
} from "./types/zod.types";
import {
  createESIMPlan,
  getESIMPlans,
  getESIMPlanDetails,
  updateESIMPlan,
  deleteESIMPlan,
  updateESIMPlanStatus,
} from "./esim.service";

const esimRouter = Router();

// GET /esim/plans — browse plans (guest sees approved only)
esimRouter.get(
  "/plans",
  optionalAuthMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).credentials?.user;
    const result = await getESIMPlans(req.query, user?.role, user?._id);
    return successResponse({
      res,
      message: "eSIM plans retrieved successfully",
      data: result.data,
      pagination: result.pagination,
    });
  })
);

// GET /esim/plans/:id
esimRouter.get(
  "/plans/:id",
  optionalAuthMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).credentials?.user;
    const plan = await getESIMPlanDetails(req.params.id, user?.role, user?._id);
    return successResponse({ res, message: "eSIM plan retrieved successfully", data: plan });
  })
);

// POST /esim/plans — Admin or Provider creates a plan
esimRouter.post(
  "/plans",
  authMiddleware,
  authorizeRoles("admin", "provider"),
  requireProviderType("telecom", "both"),
  validateRequest(CreateESIMPlanSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).credentials.user;
    const plan = await createESIMPlan(req.body, user._id, user.role);
    return successResponse({ res, statusCode: 201, message: "eSIM plan created successfully", data: plan });
  })
);

// PATCH /esim/plans/:id — owner or admin updates
esimRouter.patch(
  "/plans/:id",
  authMiddleware,
  authorizeRoles("admin", "provider"),
  validateRequest(UpdateESIMPlanSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).credentials.user;
    const plan = await updateESIMPlan(req.params.id, req.body, user._id, user.role);
    return successResponse({ res, message: "eSIM plan updated successfully", data: plan });
  })
);

// DELETE /esim/plans/:id — owner or admin deletes
esimRouter.delete(
  "/plans/:id",
  authMiddleware,
  authorizeRoles("admin", "provider"),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).credentials.user;
    const plan = await deleteESIMPlan(req.params.id, user._id, user.role);
    return successResponse({ res, message: "eSIM plan deleted successfully", data: plan });
  })
);

// PATCH /esim/plans/:id/status — Admin approves/rejects
esimRouter.patch(
  "/plans/:id/status",
  authMiddleware,
  authorizeRoles("admin"),
  validateRequest(UpdateESIMPlanStatusSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).credentials.user._id;
    const plan = await updateESIMPlanStatus(req.params.id, req.body.status, adminId);
    return successResponse({ res, message: `eSIM plan ${req.body.status} successfully`, data: plan });
  })
);

export default esimRouter;