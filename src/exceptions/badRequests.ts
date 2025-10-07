import { AppErrorCode, BaseHttpException } from "./root";

export class BadRequest extends BaseHttpException {
    constructor (public message: string, public errorCode: AppErrorCode) {
        super(message, errorCode, 400, null)
    }
}