import type { Request, Response } from "express";

import * as authService from "./auth.service";
import { loginSchema, registerSchema } from "./auth.schema";

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

export const register = async (req: Request, res: Response) => {
  const data = registerSchema.parse(req.body);

  const user = await authService.register(
    data.name,
    data.email,
    data.password
  );

  res.status(201).json({
    success: true,
    data: user,
  });
};

export const login = async (req: Request, res: Response) => {
  const data = loginSchema.parse(req.body);

  const result = await authService.login(data.email, data.password);

  res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);

  res.json({
    success: true,
    data: {
      accessToken: result.accessToken,
      user: result.user,
    },
  });
};

export const refresh = async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    throw new Error("MISSING_REFRESH_TOKEN");
  }

  const result = await authService.refresh(refreshToken);

  res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);

  res.json({
    success: true,
    data: {
      accessToken: result.accessToken,
    },
  });
};

export const logout = async (req: Request, res: Response) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    await authService.logout(refreshToken);
  }

  res.clearCookie("refreshToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth",
  });

  res.json({
    success: true,
    message: "Logged out successfully",
  });
};

export const me = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new Error("UNAUTHORIZED");
  }

  const user = await authService.getMe(req.user.id);

  if (!user) {
    throw new Error("USER_NOT_FOUND");
  }

  res.json({
    success: true,
    data: user,
  });
};