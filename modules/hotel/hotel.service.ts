import { Types } from "mongoose";

import HotelModel from "../../DB/models/hotel.model";
import RoomModel from "../../DB/models/room.model";
import BookingModel from "../../DB/models/booking.model";
import { sendNotification } from "../../utils/notifications/sendNotification";

import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from "../../utils/response/error.response";

export class HotelService {
  // GET ALL HOTELS
  static async getHotels(
    queryParam: any = {},
    userRole?: string,
    userId?: string
  ) {
    const {
      city,
      name,
      rating,
      page,
      limit,
    } = queryParam;

    const query: any = {};

    /*
      Guest / User:
      Only approved hotels.

      Admin:
      Can see all hotels.

      Provider:
      Can see:
      1. All approved hotels
      2. His own pending/rejected hotels
    */

    if (userRole === "admin") {
      // Admin sees everything
    } else if (userRole === "provider" && userId) {
      query.$or = [
        { status: "approved" },
        {
          createdBy: userId,
          status: { $in: ["pending", "rejected"] },
        },
      ];
    } else {
      // Guest / Normal User
      query.status = "approved";
    }

    // City filter
    if (city) {
      query["location.city"] = {
        $regex: city,
        $options: "i",
      };
    }

    // Name search
    if (name) {
      query.$text = {
        $search: name,
      };
    }

    // Rating filter
    if (rating) {
      query.rating = {
        $gte: Number(rating),
      };
    }

    // Pagination
    const currentPage = Math.max(Number(page) || 1, 1);

    const pageSize = Math.min(
      Math.max(Number(limit) || 10, 1),
      100
    );

    const skip = (currentPage - 1) * pageSize;

    // Text search sorting
    const sortOption = name
      ? { score: { $meta: "textScore" } }
      : {};

    const projection = name
      ? { score: { $meta: "textScore" } }
      : {};

    const [data, total] = await Promise.all([
      HotelModel.find(query, projection)
        .sort(sortOption as any)
        .skip(skip)
        .limit(pageSize),

      HotelModel.countDocuments(query),
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
  }
  // GET HOTEL BY ID
  static async getHotelDetails(
    hotelId: string,
    userRole?: string,
    userId?: string
  ) {
    const hotel = await HotelModel.findById(hotelId);

    if (!hotel) {
      throw new NotFoundException("Hotel not found");
    }

    /*
      Admin can see everything.

      Provider can see:
      - Approved hotels
      - His own pending/rejected hotels

      Guest/User:
      - Approved only
    */

    if (hotel.status !== "approved") {
      const isAdmin = userRole === "admin";

      const isOwner =
        userRole === "provider" &&
        userId &&
        hotel.createdBy.toString() === userId.toString();

      if (!isAdmin && !isOwner) {
        throw new NotFoundException("Hotel not found");
      }
    }

    const rooms = await RoomModel.find({
      hotelId,
    });

    return {
      hotel,
      rooms,
    };
  }

  // CREATE HOTEL
  static async createHotel(
    payload: any,
    userId: string,
    userRole: string
  ) {
    const {
      name,
      description,
      rating,
      location,
      amenities,
      policies,
    } = payload;

    if (!name || !location?.city) {
      throw new BadRequestException(
        "Hotel name and city are required"
      );
    }

    /*
      Admin:
      Hotel is immediately approved.

      Provider:
      Hotel starts as pending.
    */

    const status =
      userRole === "admin"
        ? "approved"
        : "pending";

    const hotel = await HotelModel.create({
      name,
      description,
      rating,
      location,
      amenities,
      policies,
      gallery: [],

      createdBy: userId,
      updatedBy: userId,

      status,
    });

    return hotel;
  }

  // UPDATE HOTEL
  static async updateHotel(
    hotelId: string,
    payload: any,
    userId: string,
    userRole: string
  ) {
    const hotel = await HotelModel.findById(hotelId);

    if (!hotel) {
      throw new NotFoundException("Hotel not found");
    }

    /*
      Admin can update any hotel.

      Provider can update only his own hotel.
    */

    if (
      userRole !== "admin" &&
      hotel.createdBy.toString() !== userId.toString()
    ) {
      throw new ForbiddenException(
        "You can only update hotels you own"
      );
    }

    // Prevent provider from changing approval status
    if (userRole !== "admin") {
      delete payload.status;
      delete payload.createdBy;
      delete payload.updatedBy;
    }

    Object.assign(hotel, payload);

    hotel.updatedBy = new Types.ObjectId(userId);

    await hotel.save();

    return hotel;
  }

  // DELETE HOTEL
  static async deleteHotel(
    hotelId: string,
    userId: string,
    userRole: string
  ) {
    const hotel = await HotelModel.findById(hotelId);

    if (!hotel) {
      throw new NotFoundException("Hotel not found");
    }

    /*
      Admin can delete any hotel.

      Provider can delete only his own hotel.
    */

    if (
      userRole !== "admin" &&
      hotel.createdBy.toString() !== userId.toString()
    ) {
      throw new ForbiddenException(
        "You can only delete hotels you own"
      );
    }

    // Bookings reference the Room ID (itemId), not the Hotel ID directly,
    // so we need to check all rooms belonging to this hotel.
    const roomIds = (await RoomModel.find({ hotelId }).select("_id")).map((r) =>
      r._id.toString()
    );

    const activeBooking = await BookingModel.findOne({
      category: "hotels",
      itemId: { $in: roomIds },
      status: { $ne: "cancelled" },
    });

    if (activeBooking) {
      throw new BadRequestException(
        "Cannot delete this hotel because one or more of its rooms have active bookings"
      );
    }

    // Also clean up the hotel's rooms once we confirm it's safe to delete
    await RoomModel.deleteMany({ hotelId });
    await HotelModel.findByIdAndDelete(hotelId);

    return hotel;
  }

  // CREATE ROOM
  static async createRoom(
    hotelId: string,
    payload: any,
    userId: string,
    userRole: string
  ) {
    const hotel = await HotelModel.findById(hotelId);

    if (!hotel) {
      throw new NotFoundException(
        "Hotel not found"
      );
    }

    /*
      Admin can add rooms to any hotel.

      Provider can add rooms only to his own hotel.
    */

    if (
      userRole !== "admin" &&
      hotel.createdBy.toString() !== userId.toString()
    ) {
      throw new ForbiddenException(
        "You can only add rooms to hotels you own"
      );
    }

    const {
      name,
      occupancy,
      pricePerNight,
      refundable,
      amenities,
    } = payload;

    if (
      !name ||
      !occupancy?.adults ||
      !pricePerNight
    ) {
      throw new BadRequestException(
        "Room name, occupancy and price are required"
      );
    }

    const room = await RoomModel.create({
      hotelId,
      name,
      occupancy,
      pricePerNight,
      refundable,
      amenities,
    });

    return room;
  }

  // ADD HOTEL IMAGES
  static async addHotelImages(
    hotelId: string,
    images: any[],
    userId: string,
    userRole: string
  ) {
    const hotel = await HotelModel.findById(hotelId);

    if (!hotel) {
      throw new NotFoundException(
        "Hotel not found"
      );
    }

    /*
      Admin can upload images to any hotel.

      Provider can upload images only to his own hotel.
    */

    if (
      userRole !== "admin" &&
      hotel.createdBy.toString() !== userId.toString()
    ) {
      throw new ForbiddenException(
        "You can only upload images to hotels you own"
      );
    }

    const gallery = images.map((img) => ({
      url: img.path,
      publicId: img.filename,
    }));

    hotel.gallery.push(...gallery);

    hotel.updatedBy = new Types.ObjectId(userId);

    await hotel.save();

    return hotel.gallery;
  }

  // UPDATE ROOM
  static async updateRoom(
    roomId: string,
    payload: any,
    userId: string,
    userRole: string
  ) {
    const room = await RoomModel.findById(roomId);

    if (!room) {
      throw new NotFoundException(
        "Room not found"
      );
    }

    const hotel = await HotelModel.findById(
      room.hotelId
    );

    if (!hotel) {
      throw new NotFoundException(
        "Hotel not found"
      );
    }

    /*
      Admin:
      Can update any room.

      Provider:
      Can update room only if he owns the hotel.
    */

    if (
      userRole !== "admin" &&
      hotel.createdBy.toString() !== userId.toString()
    ) {
      throw new ForbiddenException(
        "You can only update rooms in hotels you own"
      );
    }

    Object.assign(room, payload);

    await room.save();

    return room;
  }

  // DELETE ROOM
  static async deleteRoom(
    roomId: string,
    userId: string,
    userRole: string
  ) {
    const room = await RoomModel.findById(
      roomId
    );

    if (!room) {
      throw new NotFoundException(
        "Room not found"
      );
    }

    const hotel = await HotelModel.findById(
      room.hotelId
    );

    if (!hotel) {
      throw new NotFoundException(
        "Hotel not found"
      );
    }

    /*
      Admin:
      Can delete any room.

      Provider:
      Can delete room only from his own hotel.
    */

    if (
      userRole !== "admin" &&
      hotel.createdBy.toString() !== userId.toString()
    ) {
      throw new ForbiddenException(
        "You can only delete rooms in hotels you own"
      );
    }

    const activeBooking =
      await BookingModel.findOne({
        category: "hotels",
        itemId: roomId,
        status: {
          $ne: "cancelled",
        },
      });

    if (activeBooking) {
      throw new BadRequestException(
        "Cannot delete this room because it has active bookings"
      );
    }

    await RoomModel.findByIdAndDelete(
      roomId
    );

    return room;
  }

  // ADMIN APPROVE / REJECT HOTEL
static async updateHotelStatus(
    hotelId: string,
    status: "approved" | "rejected",
    adminId: string
  ) {
    const hotel = await HotelModel.findById(
      hotelId
    );

    if (!hotel) {
      throw new NotFoundException(
        "Hotel not found"
      );
    }

    hotel.status = status;
    hotel.updatedBy = new Types.ObjectId(adminId);

    await hotel.save();

    await sendNotification(hotel.createdBy.toString(), {
      title: status === "approved" ? "Hotel Approved" : "Hotel Rejected",
      message:
        status === "approved"
          ? `Your hotel "${hotel.name}" has been approved and is now live.`
          : `Your hotel "${hotel.name}" was rejected. Please review and update it.`,
      type: status === "approved" ? "service_approved" : "service_rejected",
      relatedId: hotel._id.toString(),
    });

    return hotel;
  }
}