import { Router, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware";
import { authorizeRoles } from "../../middleware/admin.middleware";
import { optionalAuthMiddleware } from "../../middleware/optionalAuth.middleware";
import { validateRequest } from "../../middleware/requestValidation.middleware";
import { asyncHandler } from "../../utils/response/async.handler";
import { successResponse } from "../../utils/response/success.response";
import { requireProviderType } from "../../middleware/providerType.middleware";
import {
  CreateESIMPlanSchema,
  UpdateESIMPlanSchema,
  UpdateESIMPlanStatusSchema,
  PurchaseESIMSchema,
} from "./types/zod.types";
import {
  createESIMPlan,
  getESIMPlans,
  getESIMPlanDetails,
  updateESIMPlan,
  deleteESIMPlan,
  updateESIMPlanStatus,
  purchaseESIM,
  getMyESIMOrders,
  getESIMOrderDetails,
  activateESIM,
} from "./esim.service";

const esimRouter = Router();

esimRouter.get("/plans", optionalAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).credentials?.user;
  const result = await getESIMPlans(req.query, user?.role, user?._id);
  return successResponse({ res, message: "eSIM plans retrieved successfully", data: result.data, pagination: result.pagination });
}));

esimRouter.get("/plans/:id", optionalAuthMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).credentials?.user;
  const plan = await getESIMPlanDetails(String(req.params.id), user?.role, user?._id);
  return successResponse({ res, message: "eSIM plan retrieved successfully", data: plan });
}));

esimRouter.post("/plans", authMiddleware, authorizeRoles("admin", "provider"), requireProviderType("telecom", "both"), validateRequest(CreateESIMPlanSchema), asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).credentials.user;
  const plan = await createESIMPlan(req.body, user._id, user.role);
  return successResponse({ res, statusCode: 201, message: "eSIM plan created successfully", data: plan });
}));

esimRouter.patch("/plans/:id", authMiddleware, authorizeRoles("admin", "provider"), validateRequest(UpdateESIMPlanSchema), asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).credentials.user;
  const plan = await updateESIMPlan(String(req.params.id), req.body, user._id, user.role);
  return successResponse({ res, message: "eSIM plan updated successfully", data: plan });
}));

esimRouter.delete("/plans/:id", authMiddleware, authorizeRoles("admin", "provider"), asyncHandler(async (req: Request, res: Response) => {
  const user = (req as any).credentials.user;
  const plan = await deleteESIMPlan(String(req.params.id), user._id, user.role);
  return successResponse({ res, message: "eSIM plan deleted successfully", data: plan });
}));

esimRouter.patch("/plans/:id/status", authMiddleware, authorizeRoles("admin"), validateRequest(UpdateESIMPlanStatusSchema), asyncHandler(async (req: Request, res: Response) => {
  const adminId = (req as any).credentials.user._id;
  const plan = await updateESIMPlanStatus(String(req.params.id), req.body.status, adminId);
  return successResponse({ res, message: `eSIM plan ${req.body.status} successfully`, data: plan });
}));

esimRouter.post("/orders", authMiddleware, validateRequest(PurchaseESIMSchema), asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).credentials.user._id;
  const { planId, packageBookingId } = req.body;
  const order = await purchaseESIM(userId, planId, packageBookingId);
  return successResponse({ res, statusCode: 201, message: "eSIM purchased successfully", data: order });
}));

esimRouter.get("/orders/my-orders", authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).credentials.user._id;
  const orders = await getMyESIMOrders(userId);
  return successResponse({ res, message: "eSIM orders retrieved successfully", data: orders });
}));

esimRouter.get("/orders/:id", authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).credentials.user._id;
  const order = await getESIMOrderDetails(String(req.params.id), userId);
  return successResponse({ res, message: "eSIM order retrieved successfully", data: order });
}));

esimRouter.patch("/orders/:id/activate", authMiddleware, asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).credentials.user._id;
  const order = await activateESIM(String(req.params.id), userId);
  return successResponse({ res, message: "eSIM activated successfully", data: order });
}));

export default esimRouter;
