import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import type { Role } from "../generated/prisma/client";

export const authenticate = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return next(new Error("UNAUTHORIZED"));
  }

  const token = authorization.substring(7);

  try {
    const payload = jwt.verify(token, env.accessSecret) as jwt.JwtPayload;

    if (!payload.sub || !payload.role) {
      return next(new Error("UNAUTHORIZED"));
    }

    req.user = {
      id: payload.sub,
      role: payload.role as Role,
    };

    next();
  } catch {
    next(new Error("UNAUTHORIZED"));
  }
};

export const authorize = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new Error("UNAUTHORIZED"));
    }

    if (!roles.includes(req.user.role)) {
      return next(new Error("FORBIDDEN"));
    }

    next();
  };
};