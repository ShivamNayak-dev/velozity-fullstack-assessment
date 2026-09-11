import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";

export const errorHandler: ErrorRequestHandler = (
  error,
  _req,
  res,
  _next
) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: error.flatten().fieldErrors,
      },
    });
    return;
  }

  const errorMap: Record<string, { status: number; message: string }> = {
    EMAIL_ALREADY_EXISTS: {
      status: 409,
      message: "Email already exists",
    },
    INVALID_CREDENTIALS: {
      status: 401,
      message: "Invalid email or password",
    },
    INVALID_REFRESH_TOKEN: {
      status: 401,
      message: "Invalid refresh token",
    },
    MISSING_REFRESH_TOKEN: {
      status: 401,
      message: "Refresh token is required",
    },
    USER_NOT_FOUND: {
      status: 404,
      message: "User not found",
    },
    UNAUTHORIZED: {
      status: 401,
      message: "Authentication required",
    },
    FORBIDDEN: {
      status: 403,
      message: "You do not have permission to perform this action",
    },
  };

  const mapped = errorMap[error.message];

  if (mapped) {
    res.status(mapped.status).json({
      success: false,
      error: {
        code: error.message,
        message: mapped.message,
      },
    });
    return;
  }

  console.error(error);

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Something went wrong",
    },
  });
};