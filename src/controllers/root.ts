import { login as Login, verifyMigrationOTP } from './accounts/auth/login';
import { register } from './accounts/auth/register'; // Fixed: Changed Register to register
import { TokenRefresh } from './accounts/auth/token-refresh';
import { TokenVerify } from './accounts/auth/token-verify';
import { RequestAccountVerify } from './accounts/auth/request-account-verify';
import { AccountVerify } from './accounts/auth/account-verify';
import { RequestPasswordReset } from './accounts/auth/request-password-reset';
import { PasswordReset } from './accounts/auth/password-reset';
import { RequestAccountDeletion, VerifyAccountDeletionOtp } from './accounts/auth/accoutdelection'; // Fixed: Corrected path from accoutdelection to accountdeletion
import { Me } from './accounts/profile/me';
import { ProfileUpdate, VerifyProfileUpdateOtp } from './accounts/profile/profile-update';
//import { GetOrderFeedbacks, CreateOrderFeedback } from './reviews/orderFeedback';
//import electricityRouter from './electricityController';
import { getUserById } from './accounts/auth/users'; // Add new controller

export {
  Login,
  register, // Fixed: Changed Register to register
  TokenRefresh,
  TokenVerify,
  RequestAccountVerify,
  AccountVerify,
  RequestPasswordReset,
  RequestAccountDeletion,
  PasswordReset,
  Me,
  ProfileUpdate,
  VerifyAccountDeletionOtp,
  verifyMigrationOTP,
  VerifyProfileUpdateOtp,
  getUserById,
};