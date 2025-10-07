// src/utils/fileUpload.ts
export const getFileUrl = (filename: string): string => {
  return `${process.env.API_BASE_URL || 'http://localhost:3000'}/uploads/${filename}`;
};