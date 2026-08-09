import { Types } from "mongoose";
import { IBooking } from "../../../DB/models/booking.model";

export interface CreateCheckoutSessionDTO {
  userId: Types.ObjectId;
  userEmail: string;
  /** Exactly one of these two is set — enforced by payment.validation.ts before this ever reaches the service. */
  bookingId?: string;
  packageBookingId?: string;
}

export interface CheckoutSessionResult {
  paymentId: string;
  checkoutUrl: string;
  expiresAt: Date;
}

/** Internal shape used while resolving what's being paid for, before a Payment row exists. */
export interface CheckoutTarget {
  bookings: IBooking[];
  bookingId: Types.ObjectId | null;
  packageBookingId: string | null;
  amount: number; // sum of totalPrice across `bookings`, server-computed
}
