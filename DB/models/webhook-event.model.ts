import { Schema, model, Document } from "mongoose";

export type WebhookEventStatus = "received" | "processed" | "failed";

export interface IWebhookEvent extends Document {
  /** Stripe's event ID, e.g. "evt_1N...". The unique index on this field IS the idempotency mechanism — see webhook.controller.ts for how it's used. */
  stripeEventId: string;

  /** e.g. "checkout.session.completed", "payment_intent.payment_failed", "charge.refunded" */
  type: string;

  status: WebhookEventStatus;

  livemode: boolean;

  /** Trimmed snapshot of event.data.object — enough for debugging/audit without storing Stripe's full payload verbatim. */
  objectSnapshot?: Record<string, unknown> | null;

  error?: string | null;

  receivedAt: Date;
  processedAt?: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

const webhookEventSchema = new Schema<IWebhookEvent>(
  {
    stripeEventId: {
      type: String,
      required: [true, "Stripe event ID is required"],
      unique: true,
    },

    type: {
      type: String,
      required: [true, "Event type is required"],
    },

    status: {
      type: String,
      enum: ["received", "processed", "failed"],
      default: "received",
    },

    livemode: {
      type: Boolean,
      required: true,
    },

    objectSnapshot: {
      type: Schema.Types.Mixed,
      default: null,
    },

    error: {
      type: String,
      default: null,
    },

    receivedAt: {
      type: Date,
      default: Date.now,
    },

    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

webhookEventSchema.index({ type: 1, createdAt: -1 });
webhookEventSchema.index({ status: 1 });

const WebhookEventModel = model<IWebhookEvent>(
  "WebhookEvent",
  webhookEventSchema
);

export default WebhookEventModel;
