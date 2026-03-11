import { defineMiddlewares } from "@medusajs/framework/http"
import { chainupWebhookMiddlewares } from "./hooks/payment/chainup/middlewares"

export default defineMiddlewares({
  routes: [...chainupWebhookMiddlewares],
})
