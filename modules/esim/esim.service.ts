import ESIMPlanModel from "../../DB/models/esimPlan.model";
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "../../utils/response/error.response";
import { sendNotification } from "../../utils/notifications/sendNotification";

export const createESIMPlan = async (payload: any, userId: string, userRole: string) => {
  const status = userRole === "admin" ? "approved" : "pending";

  return await ESIMPlanModel.create({
    ...payload,
    createdBy: userId,
    updatedBy: userId,
    status,
  });
};

export const getESIMPlans = async (queryParam: any = {}, userRole?: string, userId?: string) => {
  const { country, region, page, limit } = queryParam;
  const query: any = {};

  if (userRole === "admin") {
    // sees everything
  } else if (userRole === "provider" && userId) {
    query.$or = [
      { status: "approved" },
      { createdBy: userId, status: { $in: ["pending", "rejected"] } },
    ];
  } else {
    query.status = "approved";
  }

  if (country) {
    query.country = { $regex: country, $options: "i" };
  }
  if (region) {
    query.region = { $regex: region, $options: "i" };
  }

  const currentPage = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (currentPage - 1) * pageSize;

  const [data, total] = await Promise.all([
    ESIMPlanModel.find(query).sort({ price: 1 }).skip(skip).limit(pageSize),
    ESIMPlanModel.countDocuments(query),
  ]);

  return {
    data,
    pagination: {
      total,
      page: currentPage,
      pages: Math.ceil(total / pageSize),
      limit: pageSize,
    },
  };
};

export const getESIMPlanDetails = async (planId: string, userRole?: string, userId?: string) => {
  const plan = await ESIMPlanModel.findById(planId);
  if (!plan) {
    throw new NotFoundException("eSIM plan not found");
  }

  if (plan.status !== "approved") {
    const isAdmin = userRole === "admin";
    const isOwner = userRole === "provider" && userId && plan.createdBy.toString() === userId.toString();
    if (!isAdmin && !isOwner) {
      throw new NotFoundException("eSIM plan not found");
    }
  }

  return plan;
};

export const updateESIMPlan = async (planId: string, payload: any, userId: string, userRole: string) => {
  const plan = await ESIMPlanModel.findById(planId);
  if (!plan) {
    throw new NotFoundException("eSIM plan not found");
  }

  if (userRole !== "admin" && plan.createdBy.toString() !== userId.toString()) {
    throw new ForbiddenException("You can only update eSIM plans you own");
  }

  // Providers can't self-approve by sneaking a status change into an update
  if (userRole !== "admin") {
    delete payload.status;
    delete payload.createdBy;
    delete payload.updatedBy;
  }

  Object.assign(plan, payload);
  plan.updatedBy = userId as any;
  await plan.save();

  return plan;
};

export const deleteESIMPlan = async (planId: string, userId: string, userRole: string) => {
  const plan = await ESIMPlanModel.findById(planId);
  if (!plan) {
    throw new NotFoundException("eSIM plan not found");
  }

  if (userRole !== "admin" && plan.createdBy.toString() !== userId.toString()) {
    throw new ForbiddenException("You can only delete eSIM plans you own");
  }

  // Note: active-order protection will be added once eSIM Orders exist (Phase 3)

  await ESIMPlanModel.findByIdAndDelete(planId);
  return plan;
};

export const updateESIMPlanStatus = async (
  planId: string,
  status: "approved" | "rejected",
  adminId: string
) => {
  const plan = await ESIMPlanModel.findById(planId);
  if (!plan) {
    throw new NotFoundException("eSIM plan not found");
  }

  plan.status = status;
  plan.updatedBy = adminId as any;
  await plan.save();

  await sendNotification(plan.createdBy.toString(), {
    title: status === "approved" ? "eSIM Plan Approved" : "eSIM Plan Rejected",
    message:
      status === "approved"
        ? `Your eSIM plan "${plan.name}" has been approved and is now live.`
        : `Your eSIM plan "${plan.name}" was rejected. Please review and update it.`,
    type: status === "approved" ? "service_approved" : "service_rejected",
    relatedId: plan._id.toString(),
  });

  return plan;
};