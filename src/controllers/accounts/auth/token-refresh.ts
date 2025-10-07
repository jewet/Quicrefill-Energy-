import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { generateAccessToken } from "../../../lib/utils/jwt/generateTokenPair";

export const TokenRefresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await z.object({ refresh: z.string() }).parseAsync(req.body);

    const { refresh } = req.body;
    const token = await generateAccessToken(refresh);

    res.json({
      success: true,
      data: token,
      message: "Token refreshed successfully",
    });
  } catch (error) {
    next(error);
  }
};