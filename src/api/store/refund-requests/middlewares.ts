import { MiddlewareRoute } from "@medusajs/framework"
import {
  authenticate,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

const RefundAmountSchema = z.preprocess(
  (value) => (typeof value === "number" ? value.toString() : value),
  z
    .string()
    .regex(/^\d+(\.\d+)?$/, "amount must be a positive number")
    .refine((value) => Number(value) > 0, "amount must be greater than 0")
)

export const PostStoreRefundRequestSchema = z.object({
  order_id: z.string().min(1),
  payment_id: z.string().min(1),
  amount: RefundAmountSchema,
  currency_code: z.string().length(3).optional(),
  reason: z.string().max(64).optional(),
  note: z.string().max(2000).optional(),
  idempotency_key: z.string().max(128).optional(),
})

export type PostStoreRefundRequestSchemaType = z.infer<
  typeof PostStoreRefundRequestSchema
>

export const storeRefundRequestMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/refund-requests",
    method: "POST",
    middlewares: [
      authenticate("customer", ["session", "bearer"]),
      validateAndTransformBody(PostStoreRefundRequestSchema),
    ],
  },
]
