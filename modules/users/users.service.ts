import { IRequest } from "../../types/request.types";
import { successResponse } from "../../utils/response/success.response";
import { Request, Response } from "express";
import UserModel from "../../DB/models/user.model";
import {
  BadRequestException,
  NotFoundException,
} from "../../utils/response/error.response";

const toPublicProfilePicture = (
  req: Request,
  profilePicture?: { url?: string; publicId?: string }
) => {
  if (!profilePicture?.url) return profilePicture;

  if (/^https?:\/\//i.test(profilePicture.url)) return profilePicture;

  const normalizedPath = profilePicture.url.replace(/\\/g, "/");
  const filename = profilePicture.publicId || normalizedPath.split("/").pop();
  if (!filename) return profilePicture;

  return {
    ...profilePicture,
    url: `${req.protocol}://${req.get("host")}/uploads/${encodeURIComponent(filename)}`,
  };
};

export const myProfile = async (req: IRequest, res: Response) => {
  const user = req.credentials?.user;

  if (!user) {
    throw new BadRequestException("Unauthorized access");
  }

  const data = user.toJSON ? user.toJSON() : user;

  return successResponse({
    res,
    data: {
      ...data,
      profilePicture: toPublicProfilePicture(req, user.profilePicture),
    },
  });
};

export const updateProfilePicture = async (
  req: IRequest,
  res: Response
) => {
  const userId = req.credentials?.user?._id;

  if (!userId) {
    throw new BadRequestException("Unauthorized access");
  }

  const file = (req as any).file;

  if (!file) {
    throw new BadRequestException("Please upload an image file");
  }

  const user = await UserModel.findById(userId);

  if (!user) {
    throw new NotFoundException("User not found");
  }

  const storedProfilePicture = {
    url: file.path,
    publicId: file.filename,
  };
  const publicProfilePicture = toPublicProfilePicture(req, storedProfilePicture);

  user.profilePicture = {
    url: publicProfilePicture?.url || file.path,
    publicId: file.filename,
  };

  await user.save();

  return successResponse({
    res,
    message: "Profile picture uploaded successfully",
    data: {
      profilePicture: user.profilePicture,
    },
  });
};

export const updateProfileInfo = async (
  req: IRequest,
  res: Response
) => {
  const userId = req.credentials?.user?._id;

  if (!userId) {
    throw new BadRequestException("Unauthorized access");
  }

  const { name, email } = req.body;

  if (!name && !email) {
    throw new BadRequestException(
      "Please provide name or email to update"
    );
  }

  const user = await UserModel.findById(userId);

  if (!user) {
    throw new NotFoundException("User not found");
  }

  if (name) {
    user.name = name;
  }

  if (
    email &&
    email.toLowerCase() !== user.email.toLowerCase()
  ) {
    const emailExists = await UserModel.findOne({
      email: email.toLowerCase(),
    });

    if (emailExists) {
      throw new BadRequestException(
        "Email already registered by another user"
      );
    }

    user.email = email.toLowerCase();
    user.isVerified = false;
  }

  await user.save();

  return successResponse({
    res,
    message: "Profile information updated successfully",
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
        profilePicture: toPublicProfilePicture(req, user.profilePicture),
      },
    },
  });
};

export const updateUserRole = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role, providerType } = req.body;

  const validRoles = ["user", "provider", "admin"];
  if (!validRoles.includes(role)) {
    throw new BadRequestException(
      `Invalid role. Must be one of: ${validRoles.join(", ")}`
    );
  }

  if (role === "provider" && !["travel", "telecom", "both"].includes(providerType)) {
    throw new BadRequestException(
      "providerType is required for providers and must be travel, telecom, or both"
    );
  }

  const actorId = (req as IRequest).credentials?.user?._id;
  if (actorId && String(actorId) === String(id) && role !== "admin") {
    throw new BadRequestException("You cannot remove your own admin role");
  }

  const user = await UserModel.findById(id);
  if (!user) {
    throw new NotFoundException("User not found");
  }

  if (user.role === "admin" && role !== "admin") {
    const adminCount = await UserModel.countDocuments({ role: "admin" });
    if (adminCount <= 1) {
      throw new BadRequestException("At least one admin account must remain");
    }
  }

  user.role = role;
  if (role === "provider") {
    user.providerType = providerType;
  } else {
    user.providerType = undefined;
  }
  await user.save();

  return successResponse({
    res,
    message: `User role updated to "${role}" successfully`,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      providerType: user.providerType,
    },
  });
};