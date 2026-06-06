import { z } from "zod";

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20)
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export const jsonObjectSchema = z.record(z.string(), z.unknown());
export type JsonObject = z.infer<typeof jsonObjectSchema>;

export type ApiErrorResponse = {
  requestId: string;
  statusCode: number;
  message: string;
  error?: string;
};

