import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules, PaymentWebhookEvents } from "@medusajs/framework/utils"

const integrationTimeoutMs = Number(process.env.INTEGRATION_TEST_TIMEOUT_MS ?? 1800000)
jest.setTimeout(integrationTimeoutMs)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    afterEach(() => {
      jest.restoreAllMocks()
    })

    describe("POST /hooks/payment/chainup", () => {
      it("returns 400 when sign is missing", async () => {
        const eventBus = getContainer().resolve(Modules.EVENT_BUS)
        const emitSpy = jest.spyOn(eventBus, "emit")

        const response = await api.post("/hooks/payment/chainup", {
          outOrderId: "payses_123",
          orderStatus: "3",
        })

        expect(response.status).toEqual(400)
        expect(emitSpy).not.toHaveBeenCalled()
      })

      it("emits payment webhook event when schema is valid", async () => {
        const eventBus = getContainer().resolve(Modules.EVENT_BUS)
        const emitSpy = jest
          .spyOn(eventBus, "emit")
          .mockResolvedValue(undefined)

        const payload = {
          sign: "signed",
          outOrderId: "payses_123",
          orderStatus: "3",
          payAmount: "12.5",
        }

        const response = await api.post("/hooks/payment/chainup", payload)

        expect(response.status).toEqual(200)
        expect(emitSpy).toHaveBeenCalledTimes(1)

        const [event, options] = emitSpy.mock.calls[0]

        expect(event).toMatchObject({
          name: PaymentWebhookEvents.WebhookReceived,
          data: {
            provider: "chainup_platform",
            payload: {
              data: payload,
            },
          },
        })

        expect(options).toMatchObject({
          delay: expect.any(Number),
          attempts: expect.any(Number),
        })
      })
    })
  },
})
