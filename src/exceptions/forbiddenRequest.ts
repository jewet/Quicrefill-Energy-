import { AppErrorCode, BaseHttpException } from "./root";

export class ForbiddenRequest extends BaseHttpException {
    constructor(public message: string, public errorCode: AppErrorCode, public errors: any) {
        super(message, errorCode, 403, errors)
    }
}