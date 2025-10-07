

export type accessTokenPayload = {
  email: string;
  userId: string;
  role: string; // Changed from Role to string
  iat?: number;
  exp?: number;
  contextRole?: string;
};