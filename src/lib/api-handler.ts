import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { createClient } from "@/lib/supabase/server";
import { AppError, type ErrorType } from "@/core/errors";

const APP_ERROR_STATUS: Partial<Record<ErrorType, number>> = {
  INVALID_INPUT: 400,
  CONTENT_BLOCKED: 422,
  ACCOUNT_DISCONNECTED: 409,
  BUDGET_REACHED: 402,
  OUT_OF_CREDIT: 402,
  PAUSED: 409,
  RATE_LIMITED: 429,
  NOT_CONFIGURED: 503,
  PROVIDER_DOWN: 502,
  TIMEOUT: 504,
};

type Handler = (req: NextRequest, ctx: any) => Promise<NextResponse>;

interface ApiHandlerOptions {
  /** Skip the session check. Only for routes that must work logged out. */
  public?: boolean;
}

export function apiHandler(handler: Handler, options: ApiHandlerOptions = {}): Handler {
  return async (req, ctx) => {
    try {
      // Second layer behind middleware: never serve data without a session
      if (!options.public) {
        const db = await createClient();
        const { data: { user } } = await db.auth.getUser();
        if (!user) {
          return NextResponse.json(
            { error: { code: "UNAUTHORIZED", message: "Please log in to continue." } },
            { status: 401 }
          );
        }
      }

      return await handler(req, ctx);
    } catch (err: any) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: err.errors[0]?.message || "Invalid input" } },
          { status: 400 }
        );
      }

      if (err instanceof AppError) {
        return NextResponse.json(
          { error: { code: err.type, message: err.message, ...(err.fields ? { fields: err.fields } : {}) } },
          { status: APP_ERROR_STATUS[err.type] ?? 500 }
        );
      }

      const status = err.status || 500;
      const message = err.message || "Something went wrong";
      console.error(`[API] ${req.method} ${req.nextUrl.pathname}:`, err);

      return NextResponse.json(
        { error: { code: err.code || "INTERNAL_ERROR", message } },
        { status }
      );
    }
  };
}
