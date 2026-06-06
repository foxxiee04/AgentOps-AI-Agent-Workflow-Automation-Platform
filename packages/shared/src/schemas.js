"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.jsonObjectSchema = exports.paginationQuerySchema = void 0;
const zod_1 = require("zod");
exports.paginationQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().default(1),
    pageSize: zod_1.z.coerce.number().int().positive().max(100).default(20)
});
exports.jsonObjectSchema = zod_1.z.record(zod_1.z.string(), zod_1.z.unknown());
//# sourceMappingURL=schemas.js.map