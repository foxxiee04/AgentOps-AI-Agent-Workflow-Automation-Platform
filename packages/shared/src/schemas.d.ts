import { z } from "zod";
export declare const paginationQuerySchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    pageSize: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
export declare const jsonObjectSchema: z.ZodRecord<z.ZodString, z.ZodUnknown>;
export type JsonObject = z.infer<typeof jsonObjectSchema>;
export type ApiErrorResponse = {
    requestId: string;
    statusCode: number;
    message: string;
    error?: string;
};
