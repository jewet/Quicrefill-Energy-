import { NextFunction, Request, Response } from "express"

//Handles generic error handling
export const errorHandler = (controller: Function) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            await controller(req, res, next)
        } catch (err) {
            next(err)
        }
    }
}