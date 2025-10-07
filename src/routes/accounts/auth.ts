// customer-service/src/routes/accounts/auth.ts
import express, { Router } from 'express';
import dotenv from 'dotenv';
import { loginRateLimiter, authenticationMiddleware } from '../../middlewares/authentication';
import { errorHandler } from '../../lib/handlers/errorHandler';
import { passwordResetLimiter } from '../../middlewares/rateLimiter';
import {
  AccountVerify,
  Login,
  PasswordReset,
  register,
  RequestAccountVerify,
  RequestPasswordReset,
  TokenRefresh,
  TokenVerify,
  RequestAccountDeletion,
  VerifyAccountDeletionOtp,
  verifyMigrationOTP,
} from '../../controllers/root';
import { logout } from '../../controllers/accounts/auth/logout';
import { getUserById , getAllUsers} from '../../controllers/accounts/auth/users'; // Import new controller

dotenv.config();

const accountsAuthRoutes: Router = express.Router();
const apiAuthRoutes: Router = express.Router();

accountsAuthRoutes.post('/register', errorHandler(register));
accountsAuthRoutes.post('/registers', errorHandler(register));
accountsAuthRoutes.post('/login', loginRateLimiter, errorHandler(Login));
accountsAuthRoutes.post('/account-verify', errorHandler(AccountVerify));
accountsAuthRoutes.post('/request-account-verify', errorHandler(RequestAccountVerify));
accountsAuthRoutes.post('/token/refresh', errorHandler(TokenRefresh));
accountsAuthRoutes.post('/token/verify', errorHandler(TokenVerify));
accountsAuthRoutes.post('/request-password-reset', passwordResetLimiter, errorHandler(RequestPasswordReset));
accountsAuthRoutes.post('/password-reset', passwordResetLimiter, errorHandler(PasswordReset));
accountsAuthRoutes.post('/account-delete-request', authenticationMiddleware, errorHandler(RequestAccountDeletion));
accountsAuthRoutes.post('/logout', authenticationMiddleware, errorHandler(logout));
accountsAuthRoutes.post('/verify-account-deletion-otp', authenticationMiddleware, errorHandler(VerifyAccountDeletionOtp));
accountsAuthRoutes.post('/verify-migration-otp', errorHandler(verifyMigrationOTP));

accountsAuthRoutes.get('/users/:userId', authenticationMiddleware, errorHandler(getUserById));
accountsAuthRoutes.get('/users', authenticationMiddleware, errorHandler(getAllUsers));
apiAuthRoutes.post('/verify-account', errorHandler(AccountVerify));

export { accountsAuthRoutes, apiAuthRoutes };