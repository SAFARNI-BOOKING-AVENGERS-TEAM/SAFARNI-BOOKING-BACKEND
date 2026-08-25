import ESIMPlanModel from "../../DB/models/esimPlan.model";
import ESIMOrderModel from "../../DB/models/esimOrder.model";
import PaymentModel from "../../DB/models/payment.model";
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "../../utils/response/error.response";
import { sendNotification } from "../../utils/notifications/sendNotification";
import { getESIMProvider } from "./providers/esim.provider.factory";

export const createESIMPlan = async (payload: any, userId: string, userRole: string) => {
  const status = userRole === "admin" ? "approved" : "pending";
  return await ESIMPlanModel.create({ ...payload, createdBy: userId, updatedBy: userId, status });
};

export const getESIMPlans = async (queryParam: any = {}, userRole?: string, userId?: string) => {
  const { country, region, page, limit, mine } = queryParam;
  const query: any = {};

  if (userRole === "admin") {
    // Admin sees all plans.
  } else if (userRole === "provider" && userId) {
    if (String(mine) === "true") {
      query.createdBy = userId;
    } else {
      query.$or = [
        { status: "approved" },
        { createdBy: userId, status: { $in: ["pending", "rejected"] } },
      ];
    }
  } else {
    query.status = "approved";
  }

  if (country) query.country = { $regex: country, $options: "i" };
  if (region) query.region = { $regex: region, $options: "i" };

  const currentPage = Math.max(Number(page) || 1, 1);
  const pageSize = Math.min(Math.max(Number(limit) || 20, 1), 100);
  const skip = (currentPage - 1) * pageSize;

  const [data, total] = await Promise.all([
    ESIMPlanModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    ESIMPlanModel.countDocuments(query),
  ]);

  return { data, pagination: { total, page: currentPage, pages: Math.ceil(total / pageSize), limit: pageSize } };
};

export const getESIMPlanDetails = async (planId: string, userRole?: string, userId?: string) => {
  const plan = await ESIMPlanModel.findById(planId);
  if (!plan) throw new NotFoundException("eSIM plan not found");

  if (plan.status !== "approved") {
    const isAdmin = userRole === "admin";
    const isOwner = userRole === "provider" && userId && plan.createdBy.toString() === userId.toString();
    if (!isAdmin && !isOwner) throw new NotFoundException("eSIM plan not found");
  }

  return plan;
};

export const updateESIMPlan = async (planId: string, payload: any, userId: string, userRole: string) => {
  const plan = await ESIMPlanModel.findById(planId);
  if (!plan) throw new NotFoundException("eSIM plan not found");
  if (userRole !== "admin" && plan.createdBy.toString() !== userId.toString()) {
    throw new ForbiddenException("You can only update eSIM plans you own");
  }
  if (userRole !== "admin") {
    delete payload.status;
    delete payload.createdBy;
    delete payload.updatedBy;
  }

  Object.assign(plan, payload);
  plan.updatedBy = userId as any;
  // Any provider edit must be reviewed again before the changed plan is public.
  if (userRole !== "admin") plan.status = "pending";
  await plan.save();
  return plan;
};

export const deleteESIMPlan = async (planId: string, userId: string, userRole: string) => {
  const plan = await ESIMPlanModel.findById(planId);
  if (!plan) throw new NotFoundException("eSIM plan not found");
  if (userRole !== "admin" && plan.createdBy.toString() !== userId.toString()) {
    throw new ForbiddenException("You can only delete eSIM plans you own");
  }

  const activeOrder = await ESIMOrderModel.findOne({
    planId,
    status: { $in: ["pending", "processing", "completed"] },
  });
  if (activeOrder) {
    throw new BadRequestException("Cannot delete this eSIM plan because it has existing orders");
  }

  await ESIMPlanModel.findByIdAndDelete(planId);
  return plan;
};

export const updateESIMPlanStatus = async (
  planId: string,
  status: "approved" | "rejected",
  adminId: string
) => {
  const plan = await ESIMPlanModel.findById(planId);
  if (!plan) throw new NotFoundException("eSIM plan not found");

  plan.status = status;
  plan.updatedBy = adminId as any;
  await plan.save();

  await sendNotification(plan.createdBy.toString(), {
    title: status === "approved" ? "eSIM Plan Approved" : "eSIM Plan Rejected",
    message: status === "approved"
      ? `Your eSIM plan "${plan.name}" has been approved and is now live.`
      : `Your eSIM plan "${plan.name}" was rejected. Please review and update it.`,
    type: status === "approved" ? "service_approved" : "service_rejected",
    relatedId: plan._id.toString(),
  });

  return plan;
};

// Creates a payable order only. Provisioning begins only after Stripe success.
export const purchaseESIM = async (userId: string, planId: string, packageBookingId?: string) => {
  const plan = await ESIMPlanModel.findById(planId);
  if (!plan) throw new NotFoundException("eSIM plan not found");
  if (plan.status !== "approved") {
    throw new BadRequestException("This eSIM plan is not currently available for purchase");
  }

  const order = await ESIMOrderModel.create({
    userId,
    planId,
    status: "pending",
    price: plan.price,
    currency: plan.currency,
    ...(packageBookingId && { packageBookingId }),
  });

  return { ...order.toObject(), paymentStatus: "unpaid" as const };
};

// Payment layer only. Idempotent to tolerate webhook/session verification retries.
export const fulfillPaidESIMOrder = async (orderId: string) => {
  const order = await ESIMOrderModel.findById(orderId);
  if (!order) throw new NotFoundException("eSIM order not found");
  if (order.status === "completed" && order.profile) return order;
  if (order.status === "cancelled") throw new BadRequestException("Cancelled eSIM orders cannot be provisioned");

  const plan = await ESIMPlanModel.findById(order.planId);
  if (!plan) throw new NotFoundException("eSIM plan not found");

  try {
    order.status = "processing";
    await order.save();

    const provider = getESIMProvider();
    const profile = await provider.provisionESIM(plan._id.toString());
    const expiresAt = new Date(Date.now() + plan.validityDays * 24 * 60 * 60 * 1000);

    order.profile = { ...profile, expiresAt };
    order.status = "completed";
    await order.save();

    await sendNotification(order.userId.toString(), {
      title: "eSIM Ready",
      message: `Your eSIM for "${plan.name}" has been paid, provisioned, and is ready to activate.`,
      type: "booking_status_changed",
      relatedId: order._id.toString(),
    });

    return order;
  } catch (error) {
    order.status = "failed";
    await order.save();
    console.error(`[esim] Provisioning failed for paid order ${orderId}:`, error);
    throw new BadRequestException("Payment succeeded, but eSIM provisioning failed. Please retry provisioning.");
  }
};

const latestPaymentStatusByOrder = async (userId: string, orderIds: string[]) => {
  if (!orderIds.length) return new Map<string, string>();

  const payments = await PaymentModel.find({
    userId,
    esimOrderId: { $in: orderIds },
  })
    .sort({ createdAt: -1 })
    .select("esimOrderId status")
    .lean();

  const statusMap = new Map<string, string>();
  for (const payment of payments) {
    if (payment.esimOrderId && !statusMap.has(payment.esimOrderId)) {
      statusMap.set(payment.esimOrderId, payment.status);
    }
  }
  return statusMap;
};

export const getMyESIMOrders = async (userId: string) => {
  const orders = await ESIMOrderModel.find({ userId }).sort({ createdAt: -1 }).populate("planId");
  const statusMap = await latestPaymentStatusByOrder(userId, orders.map((order) => order._id.toString()));

  return orders.map((order) => ({
    ...order.toObject(),
    paymentStatus: statusMap.get(order._id.toString()) || "unpaid",
  }));
};

export const getESIMOrderDetails = async (orderId: string, userId: string) => {
  const order = await ESIMOrderModel.findById(orderId).populate("planId");
  if (!order) throw new NotFoundException("eSIM order not found");
  if (order.userId.toString() !== userId.toString()) {
    throw new ForbiddenException("You are not authorized to view this order");
  }

  if (
    order.profile &&
    order.profile.status === "ready" &&
    order.profile.expiresAt &&
    order.profile.expiresAt < new Date()
  ) {
    order.profile.status = "expired";
    await order.save();
  }

  const payment = await PaymentModel.findOne({ userId, esimOrderId: orderId })
    .sort({ createdAt: -1 })
    .select("status")
    .lean();

  return { ...order.toObject(), paymentStatus: payment?.status || "unpaid" };
};

export const activateESIM = async (orderId: string, userId: string) => {
  const order = await ESIMOrderModel.findById(orderId);
  if (!order) throw new NotFoundException("eSIM order not found");
  if (order.userId.toString() !== userId.toString()) {
    throw new ForbiddenException("You are not authorized to activate this eSIM");
  }
  if (order.status !== "completed" || !order.profile) {
    throw new BadRequestException("This eSIM is not ready for activation yet");
  }
  if (order.profile.status === "activated") {
    throw new BadRequestException("This eSIM has already been activated");
  }
  if (order.profile.expiresAt && order.profile.expiresAt < new Date()) {
    order.profile.status = "expired";
    await order.save();
    throw new BadRequestException("This eSIM has expired and can no longer be activated");
  }

  const provider = getESIMProvider();
  const activatedProfile = await provider.activateESIM(order.profile.iccid);
  order.profile.status = activatedProfile.status;
  await order.save();

  await sendNotification(userId, {
    title: "eSIM Activated",
    message: "Your eSIM has been activated successfully. Enjoy your trip!",
    type: "booking_status_changed",
    relatedId: order._id.toString(),
  });

  return order;
};
