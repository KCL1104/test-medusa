import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules, PaymentWebhookEvents } from "@medusajs/framework/utils"
import { ChainupWebhookSchemaType } from "./middlewares"

// PaymentWebhookEvents expects provider id without the "pp_" prefix.
const CHAINUP_PROVIDER_ID = "chainup_platform"

const getWebhookBody = (
  req: MedusaRequest<ChainupWebhookSchemaType>
): Record<string, unknown> => {
  const payload = (
    req.validatedBody ?? (req.body as Record<string, unknown> | undefined)
  ) as unknown

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return {}
  }

  return payload as Record<string, unknown>
}

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
    const webhookBody = getWebhookBody(req)
    const sign = webhookBody.sign

    if (typeof sign !== "string" || !sign.trim()) {
      return res.status(400).json({
        code: "10020",
        msg: "Missing sign in Star Vaults webhook payload",
      })
    }

    await eventBus.emit(
      {
        name: PaymentWebhookEvents.WebhookReceived,
        data: {
          provider: CHAINUP_PROVIDER_ID,
          payload: {
            data: webhookBody,
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
