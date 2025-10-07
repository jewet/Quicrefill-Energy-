import { AppErrorCode, BaseHttpException } from "./root";

export class UnprocessableEntity extends BaseHttpException {
    constructor (public message: string, public errorCode: AppErrorCode, public errors: any) {
        super(message, errorCode, 422, errors)
    }
}