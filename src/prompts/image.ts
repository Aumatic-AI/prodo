import type { BusinessProfile } from "@/core/profile";

export function buildImagePrompt(
  idea: string,
  profile: BusinessProfile | null,
  hasReferenceImage: boolean = false,
  product?: string
): string {
  return `${idea}.${
    profile?.description ? `We are creating an ad for Business ${profile.name}:
    ${profile.description}.` : ""
  } ${
    hasReferenceImage ? " Use the reference image as guidance for the final result." : ""
  }${
    product ? ` This image is specifically about: ${product}.` : ""
  }`;
}

export function withVideoReferenceInstruction(prompt: string): string {
  return `${prompt} The reference image shows the real product: reproduce the product exactly (shape, colours, fabric, pattern and details), the same in every scene. Use it for the product only: any person in the picture is a different person from the one in the reference (a different face and hair), and the reference's headwear, jewellery, accessories, props and background are left out.`;
}
