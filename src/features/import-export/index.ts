export const supportedImageTypes = ["image/png", "image/jpeg", "image/webp"] as const;

export type SupportedImageType = (typeof supportedImageTypes)[number];
