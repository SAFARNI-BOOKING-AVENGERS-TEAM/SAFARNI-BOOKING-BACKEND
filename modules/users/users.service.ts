import { IRequest } from "../../types/request.types";
import { successResponse } from "./../../utils/response/success.response";
import {  Response } from "express";
import UserModel from "../../DB/models/user.model";
import { BadRequestException, NotFoundException } from "../../utils/response/error.response";

export const myProfile = async (req: IRequest, res: Response) => {
  return successResponse({
    res,
    data:req.credentials?.user
  });
};

export const updateProfilePicture = async (req: IRequest, res: Response) => {
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

export const updateProfileInfo = async (req: IRequest, res: Response) => {
  const userId = req.credentials?.user?._id;
  if (!userId) {
    throw new BadRequestException("Unauthorized access");
  }

  const { name, email } = req.body;

  if (!name && !email) {
    throw new BadRequestException("Please provide name or email to update");
  }

  const user = await UserModel.findById(userId);
  if (!user) {
    throw new NotFoundException("User not found");
  }

  if (name) {
    user.name = name;
  }

  if (email && email.toLowerCase() !== user.email.toLowerCase()) {
    const emailExists = await UserModel.findOne({ email: email.toLowerCase() });
    if (emailExists) {
      throw new BadRequestException("Email already registered by another user");
    }
    user.email = email;
    user.isVerified = false; // Re-verify email upon change
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