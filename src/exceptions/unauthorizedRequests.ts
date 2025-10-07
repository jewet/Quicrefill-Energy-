import { AppErrorCode, BaseHttpException } from "./root";

export class UnauthorizedRequest extends BaseHttpException {
    constructor (public message: string, public errorCode: AppErrorCode) {
        super(message, errorCode, 401, null)
    }
}