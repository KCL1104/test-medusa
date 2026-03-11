import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, PaymentWebhookEvents } from "@medusajs/framework/utils"
import { ChainupWebhookSchemaType } from "./middlewares"

const CHAINUP_PROVIDER_ID = "pp_chainup_platform"

export async function POST(
  req: MedusaRequest<ChainupWebhookSchemaType>,
  res: MedusaResponse
) {
  try {
    const paymentModule = req.scope.resolve(Modules.PAYMENT) as {
      options?: {
        webhook_delay?: number
        webhook_retries?: number
      }
    }
    const eventBus = req.scope.resolve(Modules.EVENT_BUS)
    const requestWithRawBody = req as MedusaRequest<ChainupWebhookSchemaType> & {
      rawBody?: string | Buffer
    }

    await eventBus.emit(
      {
        name: PaymentWebhookEvents.WebhookReceived,
        data: {
          provider: CHAINUP_PROVIDER_ID,
          payload: {
            data: req.validatedBody,
            rawData: requestWithRawBody.rawBody,
            headers: req.headers,
          },
        },
      },
      {
        delay: paymentModule.options?.webhook_delay || 5000,
        attempts: paymentModule.options?.webhook_retries || 3,
      }
    )

    return res.status(200).json({ code: "0", msg: "success" })
  } catch (error: any) {
    return res.status(400).send(`Webhook Error: ${error.message}`)
  }
}
