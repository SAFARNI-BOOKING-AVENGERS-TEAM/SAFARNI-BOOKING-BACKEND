import { Schema, model, Document, Types } from "mongoose";

export interface IFavorite extends Document {
  userId: Types.ObjectId;
  category: "tours" | "hotels" | "cars" | "flights";
  itemId: string;
  createdAt: Date;
}

const favoriteSchema = new Schema<IFavorite>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    category: {
      type: String,
      enum: ["tours", "hotels", "cars", "flights"],
      required: true,
    },
    itemId: { type: String, required: true },
  },
  { timestamps: true }
);

// Prevent the same user from favoriting the same item twice
favoriteSchema.index({ userId: 1, category: 1, itemId: 1 }, { unique: true });

export default model<IFavorite>("Favorite", favoriteSchema);