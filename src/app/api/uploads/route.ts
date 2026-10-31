import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { AppError } from "@/core/errors";
import { UPLOAD_RULES, extensionFor, uploadFolder, uploadProblem, type UploadPurpose } from "@/config/uploads";
import { brandKey } from "@/providers/storage/paths";
import { signedUploadUrl } from "@/providers/storage/r2";

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

  const { businessId } = await currentBusiness();
  // The file is named by the id its database row will get
  const id = crypto.randomUUID();
  const key = brandKey(businessId, uploadFolder(purpose, contentType), id, extensionFor(contentType));
  return NextResponse.json({ id, key, url: await signedUploadUrl(key, contentType) });
});
