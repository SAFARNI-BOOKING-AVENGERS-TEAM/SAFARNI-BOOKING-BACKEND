import PackageModel from "../../DB/models/package.model";
import HotelModel from "../../DB/models/hotel.model";
import RoomModel from "../../DB/models/room.model";
import TourModel from "../../DB/models/tour.model";
import CarModel from "../../DB/models/car.model";
import FlightModel from "../../DB/models/flight.model";
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "../../utils/response/error.response";
import { sendNotification } from "../../utils/notifications/sendNotification";
import { createPackageBookingInternal } from "../booking/booking.service";

// Resolves one item's: approval status, owner, display label, and its
// "starting from" base unit price (per-night/per-day for hotels/cars,
// full price for tours/flights — since duration isn't known yet at this stage).
const resolveItem = async (category: string, itemId: string) => {
  if (category === "hotels") {
    const room = await RoomModel.findById(itemId);
    if (!room) throw new NotFoundException(`Room not found: ${itemId}`);
    const hotel = await HotelModel.findById(room.hotelId);
    if (!hotel) throw new NotFoundException(`Hotel not found for room: ${itemId}`);
    return {
      approved: hotel.status === "approved",
      ownerId: hotel.createdBy.toString(),
      label: `${hotel.name} - ${room.name}`,
      basePrice: room.pricePerNight,
    };
  }

  const modelsByCategory: Record<string, any> = {
    tours: TourModel,
    cars: CarModel,
    flights: FlightModel,
  };

  const doc = await modelsByCategory[category]?.findById(itemId);
  if (!doc) throw new NotFoundException(`${category} item not found: ${itemId}`);

  let basePrice = 0;
  if (category === "tours") basePrice = doc.priceTiers?.[0]?.price || 0;
  if (category === "cars") basePrice = doc.pricePerDay || 0;
  if (category === "flights") basePrice = doc.price || 0;

  return {
    approved: doc.status === "approved",
    ownerId: doc.createdBy.toString(),
    label: doc.title || doc.brand || doc.flightNumber || itemId,
    basePrice,
  };
};

export const createPackage = async (payload: any, userId: string, userRole: string) => {
  let estimatedOriginalPrice = 0;

  for (const item of payload.items) {
    const resolved = await resolveItem(item.category, item.itemId);

    if (!resolved.approved) {
      throw new BadRequestException(
        `Cannot add "${resolved.label}" to a package: this ${item.category} item is not approved yet`
      );
    }

    if (userRole !== "admin" && resolved.ownerId !== userId.toString()) {
      throw new ForbiddenException(
        `You can only bundle services you own (not authorized for this ${item.category} item)`
      );
    }

    estimatedOriginalPrice += resolved.basePrice;
  }

  // Admin-created packages are Safarni-curated deals, so they go live
  // immediately. Provider-created packages (from their own services)
  // need Admin approval first.
const status = userRole === "admin" ? "approved" : "pending";
  const sourceType = userRole === "admin" ? "curated" : "provider";

  return await PackageModel.create({
    ...payload,
    estimatedOriginalPrice,
    createdBy: userId,
    updatedBy: userId,
    status,
    sourceType,
  });
};

export const getPackages = async (userRole?: string, userId?: string) => {
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
    query.$or = [{ validUntil: { $exists: false } }, { validUntil: { $gte: new Date() } }];
  }

  return await PackageModel.find(query).sort({ createdAt: -1 });
};

export const getPackageDetails = async (packageId: string) => {
  const pkg = await PackageModel.findById(packageId);
  if (!pkg) throw new NotFoundException("Package not found");

  const itemsWithDetails = await Promise.all(
    pkg.items
      .sort((a, b) => a.order - b.order)
      .map(async (item) => {
        if (item.category === "hotels") {
          const room = await RoomModel.findById(item.itemId);
          const hotel = room ? await HotelModel.findById(room.hotelId) : null;
          return { category: item.category, itemId: item.itemId, order: item.order, room, hotel };
        }
        const modelsByCategory: Record<string, any> = {
          tours: TourModel,
          cars: CarModel,
          flights: FlightModel,
        };
        const doc = await modelsByCategory[item.category].findById(item.itemId);
        return { category: item.category, itemId: item.itemId, order: item.order, item: doc };
      })
  );

  // Live "estimated final price" using the discount against the
  // *stored* original estimate (so we can show "originally X, now Y"
  // even if individual item prices have since changed).
  const estimatedSavings =
    Math.round(pkg.estimatedOriginalPrice * (pkg.discountPercentage / 100) * 100) / 100;
  const estimatedFinalPrice =
    Math.round((pkg.estimatedOriginalPrice - estimatedSavings) * 100) / 100;

  return {
    package: pkg,
    items: itemsWithDetails,
    pricing: {
      estimatedOriginalPrice: pkg.estimatedOriginalPrice,
      discountPercentage: pkg.discountPercentage,
      estimatedSavings,
      estimatedFinalPrice,
      note: "Prices shown are starting-from estimates (per night/day where applicable). Your final total is calculated from live prices when you book.",
    },
  };
};

export const updatePackageStatus = async (
  packageId: string,
  status: "approved" | "rejected",
  adminId: string
) => {
  const pkg = await PackageModel.findById(packageId);
  if (!pkg) throw new NotFoundException("Package not found");

  pkg.status = status;
  pkg.updatedBy = adminId as any;
  await pkg.save();

  await sendNotification(pkg.createdBy.toString(), {
    title: status === "approved" ? "Package Approved" : "Package Rejected",
    message:
      status === "approved"
        ? `Your package "${pkg.title}" has been approved and is now live.`
        : `Your package "${pkg.title}" was rejected. Please review and update it.`,
    type: status === "approved" ? "service_approved" : "service_rejected",
    relatedId: pkg._id.toString(),
  });

  return pkg;
};

export const bookPackage = async (packageId: string, userId: string, requestedItems: any[]) => {
  const pkg = await PackageModel.findById(packageId);
  if (!pkg) {
    throw new NotFoundException("Package not found");
  }
if (pkg.validUntil && pkg.validUntil < new Date()) {
    throw new BadRequestException("This package has expired and is no longer available");
  }

  const packageKeys = new Set(pkg.items.map((i) => `${i.category}:${i.itemId}`));
  const requestedKeys = new Set(requestedItems.map((i) => `${i.category}:${i.itemId}`));

  if (
    packageKeys.size !== requestedKeys.size ||
    ![...packageKeys].every((k) => requestedKeys.has(k))
  ) {
    throw new BadRequestException(
      "The items you're booking don't match this package's items"
    );
  }

  return await createPackageBookingInternal(userId, requestedItems, pkg.discountPercentage);
};