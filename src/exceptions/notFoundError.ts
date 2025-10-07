import { BaseHttpException, AppErrorCode } from './root';

export class NotFoundError extends BaseHttpException {
  constructor(message: string, errorCode: AppErrorCode) {
    super(message, errorCode, 404, null);
  }
}