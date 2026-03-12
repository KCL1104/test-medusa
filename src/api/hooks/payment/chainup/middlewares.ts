import { MiddlewareRoute } from "@medusajs/framework"

export type ChainupWebhookSchemaType = Record<string, unknown>

export const chainupWebhookMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/hooks/payment/chainup",
    method: "POST",
  },
]
