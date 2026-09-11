import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import type { SignOptions } from "jsonwebtoken";

import { prisma } from "../../lib/prisma";
import { env } from "../../config/env";

type TokenUser = {
  id: string;
  role: string;
};

const createAccessToken = (user: TokenUser) => {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
    },
    env.accessSecret,
    {
      expiresIn: env.accessExpiresIn as SignOptions["expiresIn"],
    }
  );
};

const createRefreshToken = (user: TokenUser) => {
  return jwt.sign(
    {
      sub: user.id,
      type: "refresh",
    },
    env.refreshSecret,
    {
      expiresIn: env.refreshExpiresIn as SignOptions["expiresIn"],
    }
  );
};

const hashToken = (token: string) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const getRefreshExpiration = () => {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date;
};

export const register = async (
  name: string,
  email: string,
  password: string
) => {
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("EMAIL_ALREADY_EXISTS");
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "DEVELOPER",
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });

  return user;
};

export const login = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const validPassword = await bcrypt.compare(password, user.passwordHash);

  if (!validPassword) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const accessToken = createAccessToken(user);
  const refreshToken = createRefreshToken(user);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      expiresAt: getRefreshExpiration(),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
};

export const refresh = async (refreshToken: string) => {
  let payload: jwt.JwtPayload;

  try {
    payload = jwt.verify(refreshToken, env.refreshSecret) as jwt.JwtPayload;
  } catch {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  if (payload.type !== "refresh" || !payload.sub) {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  const tokenHash = hashToken(refreshToken);

  const storedToken = await prisma.refreshToken.findUnique({
    where: {
      tokenHash,
    },
  });

  if (
    !storedToken ||
    storedToken.revokedAt ||
    storedToken.expiresAt < new Date()
  ) {
    throw new Error("INVALID_REFRESH_TOKEN");
  }

  const user = await prisma.user.findUnique({
    where: {
      id: payload.sub,
    },
  });

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  // Rotate refresh token
  await prisma.refreshToken.update({
    where: {
      id: storedToken.id,
    },
    data: {
      revokedAt: new Date(),
    },
  });

  const newAccessToken = createAccessToken(user);
  const newRefreshToken = createRefreshToken(user);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashToken(newRefreshToken),
      expiresAt: getRefreshExpiration(),
    },
  });

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

export const logout = async (refreshToken: string) => {
  const tokenHash = hashToken(refreshToken);

  await prisma.refreshToken.updateMany({
    where: {
      tokenHash,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
    },
  });
};

export const getMe = async (userId: string) => {
  return prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
    },
  });
};