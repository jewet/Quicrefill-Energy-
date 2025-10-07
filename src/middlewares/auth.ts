// import { Request, Response, NextFunction } from "express";
// import { verifyToken } from "../lib/utils/jwt/verifyToken";

// export const AuthJwtMiddleware = async (req: Request, res: Response, next: NextFunction) => {
//     const token = req.headers.authorization?.split("Bearer ")[1];
//     if (!token) {
//         res.status(401).json({ message: "Unauthorized: No token provided" });
//         return;
//     }
//     try {
//         const payload = await verifyToken(token, "access");
//         if(!payload) {
//             res.status(403).json({ message: "Unauthorized: Invalid token" });
//         }
//         req.user = payload;
//         next();
        
//     }
//     catch (error) { res.status(403).json({ message: "Unauthorized: Invalid token" }); }
// }