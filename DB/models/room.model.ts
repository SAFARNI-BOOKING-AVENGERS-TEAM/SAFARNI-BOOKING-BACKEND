import { Schema, model, Document, Types } from "mongoose";

export interface Room extends Document {
  hotelId: Types.ObjectId;

  name: string;

  occupancy: {
    adults: number;
    children: number;
  };

  pricePerNight: number;
  refundable: boolean;
  amenities?: string[];
}

const RoomSchema = new Schema<Room>(
  {
    hotelId: {
      type: Schema.Types.ObjectId,
      ref: "Hotel",
      required: true
    },

    name: {
      type: String,
      required: true
    },

    occupancy: {
      adults: { type: Number, required: true },
      children: { type: Number, default: 0 }
    },

    pricePerNight: {
      type: Number,
      required: true
    },

    refundable: {
      type: Boolean,
      default: false
    },

    amenities: [String]
  },
  { timestamps: true }
);

const RoomModel = model<Room>("Room", RoomSchema);

export default RoomModel;
