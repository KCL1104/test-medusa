import { MiddlewareRoute } from "@medusajs/framework"
import {
  authenticate,
  validateAndTransformBody,
} from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"

const CoinGrantAmountSchema = z.preprocess(
  (value) => (typeof value === "number" ? value.toString() : value),
  z
    .string()
    .regex(/^\d+(\.\d+)?$/, "amount must be a positive number")
    .refine((value) => Number(value) > 0, "amount must be greater than 0")
)

export const PostAdminCoinGrantSchema = z
  .object({
    app_order_id: z.string().min(1),
    amount: CoinGrantAmountSchema,
    pay_coin_symbol: z.string().min(1).optional(),
    open_id: z.string().min(1).optional(),
    user_id: z.string().min(1).optional(),
    order_scene_type: z.string().min(1).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((value) => Boolean(value.open_id || value.user_id), {
    message: "Either open_id or user_id is required.",
    path: ["open_id"],
  })

export type PostAdminCoinGrantSchemaType = z.infer<typeof PostAdminCoinGrantSchema>

export const adminCoinGrantMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/chainup/coin-grants",
    method: "POST",
    middlewares: [
      authenticate("user", ["session", "bearer", "api-key"]),
      validateAndTransformBody(PostAdminCoinGrantSchema),
    ],
  },
]
