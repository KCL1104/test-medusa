import { MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework"
import { z } from "zod"

export const ChainupWebhookSchema = z
  .object({
    sign: z.string().min(1),
  })
  .passthrough()

export type ChainupWebhookSchemaType = z.infer<typeof ChainupWebhookSchema>

export const chainupWebhookMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/hooks/payment/chainup",
    method: "POST",
    middlewares: [validateAndTransformBody(ChainupWebhookSchema)],
  },
]
