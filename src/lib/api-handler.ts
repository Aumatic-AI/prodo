import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";

type Handler = (req: NextRequest, ctx: any) => Promise<NextResponse>;

export function apiHandler(handler: Handler): Handler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err: any) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: { code: "VALIDATION_ERROR", message: err.errors[0]?.message || "Invalid input" } },
          { status: 400 }
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
