import { Router } from "express";
import { accountsAuthRoutes } from "./auth"; // Changed to named import
import { userRoutes } from "./profile";

const accountRoutes = Router();

// Mount authentication routes under /accounts/auth/
accountRoutes.use("/auth/", accountsAuthRoutes);

// Mount profile routes under /accounts/profile/
accountRoutes.use("/profile/", userRoutes);

export default accountRoutes;