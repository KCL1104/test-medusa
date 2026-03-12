import { defineMiddlewares } from "@medusajs/framework/http"
import { chainupWebhookMiddlewares } from "./hooks/payment/chainup/middlewares"
import { adminCoinGrantMiddlewares } from "./admin/chainup/coin-grants/middlewares"
import { adminRefundRequestMiddlewares } from "./admin/refund-requests/middlewares"
import { storeRefundRequestMiddlewares } from "./store/refund-requests/middlewares"

export default defineMiddlewares({
  routes: [
    ...chainupWebhookMiddlewares,
    ...storeRefundRequestMiddlewares,
    ...adminRefundRequestMiddlewares,
    ...adminCoinGrantMiddlewares,
  ],
})
