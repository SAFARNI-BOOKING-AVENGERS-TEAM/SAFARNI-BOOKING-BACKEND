import crypto from "crypto";

export const createRandomToken = () => {
  const token = crypto
    .randomBytes(Number(process.env.RANDOM_BYTES_COUNT || 12))
    .toString("hex");
  return token;
};
