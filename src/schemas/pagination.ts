import { z } from "zod";


export const paginationParamSchema = z.object({
    limit: z.coerce.number().optional(),
    page: z.coerce.number().optional(),
}).superRefine((data, ctx)=>{
    if ((data.limit || data.page) && !(data.limit && data.page)) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "to paginate 'limit' and 'page' is required",
        })
    }
})