import Tour, { ITour } from "../../DB/models/tour.model";
import BookingModel from "../../DB/models/booking.model";
import { sendNotification } from "../../utils/notifications/sendNotification";

import {
  BadRequestException,
  NotFoundException,
  UnAuthorizedException,
  ForbiddenException,
  ConflictException,
} from "../../utils/response/error.response";

// CREATE TOUR
// Admin -> approved
// Provider -> pending
export const createTour = async (
  data: Partial<ITour>,
  userId: string,
  userRole: string
): Promise<ITour> => {
  if (!userId) {
    throw new UnAuthorizedException(
      "Authentication credentials not found"
    );
  }

  const existingTour = await Tour.findOne({
    slug: data.slug,
  });

  if (existingTour) {
    throw new ConflictException(
      `A tour with slug "${data.slug}" already exists`
    );
  }

  const tour = await Tour.create({
    ...data,

    // Ownership
    createdBy: userId,
    updatedBy: userId,

    // Admin -> approved
    // Provider -> pending
    status:
      userRole === "admin"
        ? "approved"
        : "pending",
  });

  return tour;
};

// GET ALL TOURS
// Public:
// - Not logged in -> approved only
// - User -> approved only
// - Provider -> approved + own tours
// - Admin -> all tours
export const getTours = async (
  queryParam: any = {},
  userRole?: string,
  userId?: string
) => {
  const {
    title,
    city,
    difficulty,
    recommended,
    page,
    limit,
    status: requestedStatus,
    ...otherFilters
  } = queryParam;

  const query: any = {
    ...otherFilters,
  };

  // STATUS VISIBILITY

  if (userRole === "admin") {
    // Admin can see all statuses
    // If admin explicitly requests a status,
    // filter by that status
    if (requestedStatus) {
      query.status = requestedStatus;
    }
  } else if (userRole === "provider" && userId) {
    // Provider can see:
    // 1. Approved tours
    // 2. His own pending/rejected tours
    query.$or = [
      {
        status: "approved",
      },
      {
        createdBy: userId,
      },
    ];
  } else {
    // Public users and normal users
    // can only see approved tours
    query.status = "approved";
  }

  // SEARCH BY TITLE
  if (title) {
    query.$text = {
      $search: title,
    };
  }

  // FILTER BY CITY
  if (city) {
    query["locations.city"] = {
      $regex: city,
      $options: "i",
    };
  }

  // FILTER BY DIFFICULTY
  if (difficulty) {
    query.difficulty = difficulty;
  }

  // FILTER BY RECOMMENDED
  if (recommended !== undefined) {
    query.recommended =
      recommended === "true";
  }

  // PAGINATION
  const currentPage = Math.max(
    Number(page) || 1,
    1
  );

  const pageSize = Math.min(
    Math.max(Number(limit) || 10, 1),
    100
  );

  const skip =
    (currentPage - 1) * pageSize;

  // TEXT SEARCH
  const sortOption = title
    ? {
        score: {
          $meta: "textScore",
        },
      }
    : {};

  const projection = title
    ? {
        score: {
          $meta: "textScore",
        },
      }
    : {};

  const [data, total] =
    await Promise.all([
      Tour.find(query, projection)
        .sort(sortOption as any)
        .skip(skip)
        .limit(pageSize),

      Tour.countDocuments(query),
    ]);

  return {
    data,

    pagination: {
      total,
      page: currentPage,
      pages: Math.ceil(
        total / pageSize
      ),
      limit: pageSize,
    },
  };
};

// GET TOUR BY ID
// Public:
// - User -> approved only
// - Provider -> approved + own tour
// - Admin -> all tours
export const getTourById = async (
  id: string,
  userRole?: string,
  userId?: string
): Promise<ITour> => {
  const tour = await Tour.findById(id);

  if (!tour) {
    throw new NotFoundException(
      "Tour not found"
    );
  }

  // Admin can see everything
  if (userRole === "admin") {
    return tour;
  }

  // Provider can see approved tours
  // or tours owned by himself
  if (userRole === "provider") {
    const isOwner =
      userId &&
      tour.createdBy.toString() ===
        userId.toString();

    if (
      tour.status === "approved" ||
      isOwner
    ) {
      return tour;
    }

    throw new NotFoundException(
      "Tour not found"
    );
  }

  // Public / normal user
  // can only see approved tours
  if (tour.status !== "approved") {
    throw new NotFoundException(
      "Tour not found"
    );
  }

  return tour;
};

// UPDATE TOUR
// Admin -> can update any tour
// Provider -> can update own tour only
export const updateTour = async (
  id: string,
  data: Partial<ITour>,
  userId: string,
  userRole: string
): Promise<ITour> => {
  if (!userId) {
    throw new UnAuthorizedException(
      "Authentication credentials not found"
    );
  }

  const tour = await Tour.findById(id);

  if (!tour) {
    throw new NotFoundException(
      "Tour not found"
    );
  }

  // Provider can only update own tours
  if (
    userRole !== "admin" &&
    tour.createdBy.toString() !==
      userId.toString()
  ) {
    throw new ForbiddenException(
      "You can only update tours you own"
    );
  }

  // CHECK SLUG UNIQUENESS
  if (
    data.slug &&
    data.slug !== tour.slug
  ) {
    const existingTour =
      await Tour.findOne({
        slug: data.slug,
        _id: {
          $ne: id,
        },
      });

    if (existingTour) {
      throw new ConflictException(
        `A tour with slug "${data.slug}" already exists`
      );
    }
  }

  // UPDATE DATA
  Object.assign(tour, data);

  tour.updatedBy = userId as any;

  await tour.save();

  return tour;
};

// DELETE TOUR
// Admin -> can delete any tour
// Provider -> can delete own tour only
export const deleteTour = async (
  id: string,
  userId: string,
  userRole: string
): Promise<ITour> => {
  if (!userId) {
    throw new UnAuthorizedException(
      "Authentication credentials not found"
    );
  }

  const tour = await Tour.findById(id);

  if (!tour) {
    throw new NotFoundException(
      "Tour not found"
    );
  }

  // Provider can only delete own tours
  if (
    userRole !== "admin" &&
    tour.createdBy.toString() !==
      userId.toString()
  ) {
    throw new ForbiddenException(
      "You can only delete tours you own"
    );
  }

  // PREVENT DELETE
  // IF ACTIVE BOOKING EXISTS
  const activeBooking =
    await BookingModel.findOne({
      category: "tours",
      itemId: id,
      status: {
        $ne: "cancelled",
      },
    });

  if (activeBooking) {
    throw new BadRequestException(
      "Cannot delete this tour because it has active bookings"
    );
  }

  await Tour.findByIdAndDelete(id);

  return tour;
};

// ADMIN APPROVE / REJECT TOUR
export const updateTourStatus = async (
  id: string,
  status: "approved" | "rejected",
  adminId: string
): Promise<ITour> => {
  if (!adminId) {
    throw new UnAuthorizedException(
      "Authentication credentials not found"
    );
  }

  const tour = await Tour.findById(id);

  if (!tour) {
    throw new NotFoundException(
      "Tour not found"
    );
  }

  // Update status
// Update status
  tour.status = status;

  // Track admin who changed status
  tour.updatedBy = adminId as any;

  await tour.save();

  await sendNotification(tour.createdBy.toString(), {
    title: status === "approved" ? "Tour Approved" : "Tour Rejected",
    message:
      status === "approved"
        ? `Your tour "${tour.title}" has been approved and is now live.`
        : `Your tour "${tour.title}" was rejected. Please review and update it.`,
    type: status === "approved" ? "service_approved" : "service_rejected",
    relatedId: (tour._id as any).toString(),
  });

  return tour;
};
<<<<<<< HEAD
=======
export const addOrUpdateReview = async (
  tourId: string,
  userId: string,
  rating: number,
  comment?: string
) => {
  const tour = await Tour.findById(tourId);
  if (!tour) {
    throw new NotFoundException("Tour not found");
  }
  // Prevent users from reviewing their own tours
if (tour.createdBy.toString() === userId.toString()) {
    throw new ForbiddenException(
      "You cannot review your own tour"
    );
  }
  // Only someone with a confirmed booking on this tour can review it
  const hasConfirmedBooking = await BookingModel.findOne({
    userId,
    category: "tours",
    itemId: tourId,
    status: "confirmed",
  });

  if (!hasConfirmedBooking) {
    throw new ForbiddenException(
      "You can only review a tour after your booking for it has been confirmed"
    );
  }

  const existingReview = tour.reviews.find(
    (r) => r.userId.toString() === userId.toString()
  );

  if (existingReview) {
    existingReview.rating = rating;
    existingReview.comment = comment;
  } else {
    tour.reviews.push({ userId: userId as any, rating, comment } as any);
  }

  await tour.save();
  return tour.reviews;
};
// GET TOUR REVIEWS
export const getTourReviews = async (tourId: string) => {
  const tour = await Tour.findById(tourId).populate(
    "reviews.userId",
    "name"
  );
  if (!tour) {
    throw new NotFoundException("Tour not found");
  }

  const averageRating =
    tour.reviews.length > 0
      ? tour.reviews.reduce((sum, r) => sum + r.rating, 0) / tour.reviews.length
      : 0;

  return {
    reviews: tour.reviews,
    averageRating: Math.round(averageRating * 10) / 10,
    totalReviews: tour.reviews.length,
  };
};

export const deleteReview = async (
  tourId: string,
  reviewUserId: string,
  requesterId: string,
  requesterRole: string
) => {
  const tour = await Tour.findById(tourId);
  if (!tour) {
    throw new NotFoundException("Tour not found");
  }

  const reviewIndex = tour.reviews.findIndex(
    (r) => r.userId.toString() === reviewUserId.toString()
  );

  if (reviewIndex === -1) {
    throw new NotFoundException("Review not found");
  }

  if (
    requesterRole !== "admin" &&
    tour.reviews[reviewIndex].userId.toString() !== requesterId.toString()
  ) {
    throw new ForbiddenException("You can only delete your own review");
  }

  tour.reviews.splice(reviewIndex, 1);
  await tour.save();
  return tour.reviews;
};
>>>>>>> origin/main
