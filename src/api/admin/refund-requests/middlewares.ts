import { MiddlewareRoute } from "@medusajs/framework"
import {
  authenticate,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

const OptionalRefundAmountSchema = z.preprocess(
  (value) => (typeof value === "number" ? value.toString() : value),
  z
    .string()
    .regex(/^\d+(\.\d+)?$/, "amount must be a positive number")
    .refine((value) => Number(value) > 0, "amount must be greater than 0")
    .optional()
)

export const PostAdminRefundRequestReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  amount: OptionalRefundAmountSchema,
  note: z.string().max(2000).optional(),
})

export type PostAdminRefundRequestReviewSchemaType = z.infer<
  typeof PostAdminRefundRequestReviewSchema
>

export const adminRefundRequestMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/refund-requests/:id",
    method: "POST",
    middlewares: [
      authenticate("user", ["session", "bearer", "api-key"]),
      validateAndTransformBody(PostAdminRefundRequestReviewSchema),
    ],
  },
]
