import { AppErrorCode, BaseHttpException } from "./root";

export class NotFound extends BaseHttpException {
    constructor (public message: string, public errorCode: AppErrorCode, errors: any) {
        super(message, errorCode, 404, errors)
    }
}