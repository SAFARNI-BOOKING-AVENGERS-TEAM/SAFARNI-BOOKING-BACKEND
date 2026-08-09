import { Router } from "express";
import { asyncHandler } from "../../utils/response/async.handler";
import { handleStripeWebhook } from "./webhook.controller";

const webhookRouter = Router();

webhookRouter.post("/", asyncHandler(handleStripeWebhook));

export default webhookRouter;
