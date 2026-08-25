import { IRequest } from "../../types/request.types";
import { successResponse } from "../../utils/response/success.response";
<<<<<<< HEAD
import { Response } from "express";
=======
import { Request, Response } from "express";
>>>>>>> origin/main
import UserModel from "../../DB/models/user.model";
import {
  BadRequestException,
  NotFoundException,
} from "../../utils/response/error.response";

export const myProfile = async (req: IRequest, res: Response) => {
  return successResponse({
    res,
    data: req.credentials?.user,
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

  user.profilePicture = {
    url: file.path,
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
        profilePicture: user.profilePicture,
      },
    },
  });
};

// ADMIN: Update User Role
<<<<<<< HEAD
export const updateUserRole = async (
  req: IRequest,
  res: Response
) => {
  const { id } = req.params;
  const { role } = req.body;

  const validRoles = ["user", "provider", "admin"];

  if (!role || !validRoles.includes(role)) {
=======
export const updateUserRole = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { role, providerType } = req.body;

  const validRoles = ["user", "provider", "admin"];
  if (!validRoles.includes(role)) {
>>>>>>> origin/main
    throw new BadRequestException(
      `Invalid role. Must be one of: ${validRoles.join(", ")}`
    );
  }

<<<<<<< HEAD
  const user = await UserModel.findById(id);

=======
  if (role === "provider" && providerType && !["travel", "telecom", "both"].includes(providerType)) {
    throw new BadRequestException(
      `Invalid providerType. Must be one of: travel, telecom, both`
    );
  }

  const user = await UserModel.findById(id);
>>>>>>> origin/main
  if (!user) {
    throw new NotFoundException("User not found");
  }

  user.role = role;
<<<<<<< HEAD

=======
  if (role === "provider" && providerType) {
    user.providerType = providerType;
  }
>>>>>>> origin/main
  await user.save();

  return successResponse({
    res,
    message: `User role updated to "${role}" successfully`,
    data: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
<<<<<<< HEAD
=======
      providerType: user.providerType,
>>>>>>> origin/main
    },
  });
};