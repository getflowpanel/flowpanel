/**
 * Zod input schemas for every resource-related tRPC procedure.
 *
 * Extracted out of `resources.ts` so procedures can import only what they
 * need, and so the list of operations is visible at a glance.
 */

import { z } from "zod";

export const filterInputSchema = z.object({
  field: z.string(),
  op: z.enum([
    "eq",
    "neq",
    "contains",
    "startsWith",
    "endsWith",
    "in",
    "notIn",
    "gte",
    "lte",
    "gt",
    "lt",
    "isNull",
    "isNotNull",
  ]),
  value: z.unknown(),
});

export const listInputSchema = z.object({
  resourceId: z.string(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(50),
  sort: z
    .object({
      field: z.string(),
      dir: z.enum(["asc", "desc"]),
    })
    .optional(),
  search: z
    .object({
      query: z.string(),
      fields: z.array(z.string()).optional(),
    })
    .optional(),
  filters: z.array(filterInputSchema).optional(),
});

export const getInputSchema = z.object({
  resourceId: z.string(),
  recordId: z.union([z.string(), z.number()]),
});

export const createInputSchema = z.object({
  resourceId: z.string(),
  data: z.record(z.unknown()),
});

export const updateInputSchema = z.object({
  resourceId: z.string(),
  recordId: z.union([z.string(), z.number()]),
  data: z.record(z.unknown()),
});

export const deleteInputSchema = z.object({
  resourceId: z.string(),
  recordId: z.union([z.string(), z.number()]),
});

export const actionInputSchema = z.object({
  resourceId: z.string(),
  actionId: z.string(),
  recordId: z.union([z.string(), z.number()]),
});

export const bulkActionInputSchema = z.object({
  resourceId: z.string(),
  actionId: z.string(),
  recordIds: z
    .array(z.union([z.string(), z.number()]))
    .min(1)
    .max(1000),
});

export const collectionActionInputSchema = z.object({
  resourceId: z.string(),
  actionId: z.string(),
});

export const dialogActionInputSchema = z.object({
  resourceId: z.string(),
  actionId: z.string(),
  values: z.record(z.unknown()),
  recordId: z.union([z.string(), z.number()]).optional(),
});
