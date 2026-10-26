import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { AppError } from "@/core/errors";
import { UPLOAD_RULES, extensionFor, uploadProblem, type UploadPurpose } from "@/config/uploads";
import { businessKey, signedUploadUrl } from "@/providers/storage/supabase-storage";

const bodySchema = z.object({
  purpose: z.enum(Object.keys(UPLOAD_RULES) as [UploadPurpose, ...UploadPurpose[]]),
  contentType: z.string().min(1),
  size: z.number().int().positive(),
});

// Signed link for a direct browser-to-storage upload (skips Vercel's 4.5 MB body limit)
export const POST = apiHandler(async (req: NextRequest) => {
  const { purpose, contentType, size } = bodySchema.parse(await req.json());
  const problem = uploadProblem(purpose, contentType, size);
  if (problem) throw new AppError(problem, "INVALID_INPUT", false);

  const { db, businessId } = await currentBusiness();
  const key = businessKey(businessId, `${UPLOAD_RULES[purpose].folder}/${crypto.randomUUID()}.${extensionFor(contentType)}`);
  const { token, path } = await signedUploadUrl(db, key);
  return NextResponse.json({ key, path, token });
});
