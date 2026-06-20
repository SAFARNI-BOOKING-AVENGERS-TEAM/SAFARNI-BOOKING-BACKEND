import bcrypt from "bcrypt";

const SALT_ROUNDS = Number(process.env.HASH_ROUNDS) || 12;

export const hashString = async (plainText: string) => {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hash = await bcrypt.hash(plainText, salt);
  return hash;
};

export const compareHash = async (plainText: string, hashedValue: string) => {
  return await bcrypt.compare(plainText, hashedValue);
};
