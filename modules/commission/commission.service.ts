import { Types } from "mongoose";
import BookingModel, { IBooking } from "../../DB/models/booking.model";
import CommissionModel, { CommissionStatus, ICommissionRecord } from "../../DB/models/commission.model";
import HotelModel from "../../DB/models/hotel.model";
import RoomModel from "../../DB/models/room.model";
import TourModel from "../../DB/models/tour.model";
import CarModel from "../../DB/models/car.model";
import FlightModel from "../../DB/models/flight.model";
import UserModel from "../../DB/models/user.model";

export const SAFARNI_COMMISSION_RATE_PERCENT = 10;

const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

const resolveBookingProviderId = async (booking: IBooking): Promise<Types.ObjectId | null> => {
  let ownerId: Types.ObjectId | null = null;

  if (booking.category === "hotels") {
    const room = await RoomModel.findById(booking.itemId).select("hotelId");
    if (!room) return null;
    const hotel = await HotelModel.findById(room.hotelId).select("createdBy");
    ownerId = hotel?.createdBy ? new Types.ObjectId(String(hotel.createdBy)) : null;
  } else if (booking.category === "tours") {
    const tour = await TourModel.findById(booking.itemId).select("createdBy");
    ownerId = tour?.createdBy ? new Types.ObjectId(String(tour.createdBy)) : null;
  } else if (booking.category === "cars") {
    const car = await CarModel.findById(booking.itemId).select("createdBy");
    ownerId = car?.createdBy ? new Types.ObjectId(String(car.createdBy)) : null;
  } else if (booking.category === "flights") {
    const flight = await FlightModel.findById(booking.itemId).select("createdBy");
    ownerId = flight?.createdBy ? new Types.ObjectId(String(flight.createdBy)) : null;
  }

  if (!ownerId) return null;
  const isProvider = await UserModel.exists({ _id: ownerId, role: "provider" });
  return isProvider ? ownerId : null;
};

const statusForBooking = (booking: IBooking): CommissionStatus =>
  booking.status === "confirmed" && booking.endDate.getTime() <= Date.now() ? "earned" : "pending";

export const ensureCommissionRecordForBooking = async (
  booking: IBooking,
  paymentId: string,
  currency = "usd"
): Promise<ICommissionRecord | null> => {
  const providerId = await resolveBookingProviderId(booking);
  if (!providerId) return null;

  const grossAmount = roundMoney(booking.totalPrice);
  const commissionAmount = roundMoney(
    (grossAmount * SAFARNI_COMMISSION_RATE_PERCENT) / 100
  );
  const providerNetAmount = roundMoney(grossAmount - commissionAmount);
  const initialStatus = statusForBooking(booking);
  const now = new Date();

  let record = await CommissionModel.findOneAndUpdate(
    { bookingId: booking._id.toString() },
    {
      $setOnInsert: {
        bookingId: booking._id.toString(),
        packageBookingId: booking.packageBookingId,
        paymentId,
        providerId,
        category: booking.category,
        grossAmount,
        commissionRatePercent: SAFARNI_COMMISSION_RATE_PERCENT,
        commissionAmount,
        providerNetAmount,
        currency: currency.toLowerCase(),
        bookingEndDate: booking.endDate,
        status: initialStatus,
        ...(initialStatus === "earned" && { recognizedAt: now }),
      },
    },
    { upsert: true, new: true }
  );

  if (record.status === "pending" && initialStatus === "earned") {
    record.status = "earned";
    record.recognizedAt = record.recognizedAt || now;
    await record.save();
  }

  return record;
};

export const reconcileCommissionRecords = async (providerId?: string) => {
  const filter: Record<string, unknown> = { status: "pending", bookingEndDate: { $lte: new Date() } };
  if (providerId) filter.providerId = providerId;

  const records = await CommissionModel.find(filter);
  if (!records.length) return 0;

  const bookings = await BookingModel.find({
    _id: { $in: records.map((record) => record.bookingId) },
  }).select("_id status endDate");
  const bookingById = new Map(bookings.map((booking) => [booking._id.toString(), booking]));

  let changed = 0;
  for (const record of records) {
    const booking = bookingById.get(record.bookingId);
    if (!booking || booking.status !== "confirmed" || booking.endDate.getTime() > Date.now()) continue;
    record.status = "earned";
    record.recognizedAt = record.recognizedAt || new Date();
    await record.save();
    changed += 1;
  }

  return changed;
};

export const markCommissionReversalPending = async (bookingId: string) => {
  return CommissionModel.findOneAndUpdate(
    { bookingId, status: { $in: ["pending", "earned"] } },
    { $set: { status: "reversal_pending" } },
    { new: true }
  );
};

export const reverseCommissionForBooking = async (
  bookingId: string,
  stripeRefundId: string,
  refundAmount: number
) => {
  return CommissionModel.findOneAndUpdate(
    { bookingId },
    {
      $set: {
        status: "reversed",
        reversedAt: new Date(),
        stripeRefundId,
        refundAmount: roundMoney(refundAmount),
      },
    },
    { new: true }
  );
};

const sum = (records: ICommissionRecord[], field: keyof Pick<ICommissionRecord, "grossAmount" | "commissionAmount" | "providerNetAmount">) =>
  roundMoney(records.reduce((total, record) => total + Number(record[field] || 0), 0));

export const getProviderCommissionSummary = async (providerId: string) => {
  await reconcileCommissionRecords(providerId);
  const records = await CommissionModel.find({ providerId });

  const earned = records.filter((record) => record.status === "earned");
  const pending = records.filter((record) => record.status === "pending");
  const reversalPending = records.filter((record) => record.status === "reversal_pending");
  const reversed = records.filter((record) => record.status === "reversed");

  return {
    commissionRatePercent: SAFARNI_COMMISSION_RATE_PERCENT,
    completedBookings: earned.length,
    grossCompleted: sum(earned, "grossAmount"),
    platformCommission: sum(earned, "commissionAmount"),
    providerNet: sum(earned, "providerNetAmount"),
    pendingGross: sum(pending, "grossAmount"),
    reversalPendingGross: sum(reversalPending, "grossAmount"),
    reversedGross: sum(reversed, "grossAmount"),
    reversedCommission: sum(reversed, "commissionAmount"),
  };
};

export const getPlatformCommissionSummary = async () => {
  await reconcileCommissionRecords();
  const records = await CommissionModel.find();
  const earned = records.filter((record) => record.status === "earned");
  const pending = records.filter((record) => record.status === "pending");
  const reversalPending = records.filter((record) => record.status === "reversal_pending");
  const reversed = records.filter((record) => record.status === "reversed");

  return {
    commissionRatePercent: SAFARNI_COMMISSION_RATE_PERCENT,
    completedBookings: earned.length,
    grossCompleted: sum(earned, "grossAmount"),
    commissionEarned: sum(earned, "commissionAmount"),
    providerNetPayable: sum(earned, "providerNetAmount"),
    pendingGross: sum(pending, "grossAmount"),
    reversalPendingGross: sum(reversalPending, "grossAmount"),
    reversedGross: sum(reversed, "grossAmount"),
    reversedCommission: sum(reversed, "commissionAmount"),
  };
};

export const getCommissionAuditRecords = async (query: Record<string, unknown>) => {
  const page = Math.max(Number(query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 100);
  const filter: Record<string, unknown> = {};
  if (query.status && ["pending", "earned", "reversal_pending", "reversed"].includes(String(query.status))) {
    filter.status = String(query.status);
  }
  if (query.providerId && Types.ObjectId.isValid(String(query.providerId))) {
    filter.providerId = String(query.providerId);
  }

  await reconcileCommissionRecords(query.providerId ? String(query.providerId) : undefined);

  const [items, total] = await Promise.all([
    CommissionModel.find(filter)
      .populate("providerId", "name email")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    CommissionModel.countDocuments(filter),
  ]);

  return { items, pagination: { total, page, limit, pages: Math.ceil(total / limit) } };
};
