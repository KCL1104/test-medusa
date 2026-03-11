import { medusaIntegrationTestRunner } from "@medusajs/test-utils"

const integrationTimeoutMs = Number(process.env.INTEGRATION_TEST_TIMEOUT_MS ?? 1800000)
jest.setTimeout(integrationTimeoutMs)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api }) => {
    describe("Ping", () => {
      it("ping the server health endpoint", async () => {
        const response = await api.get('/health')
        expect(response.status).toEqual(200)
      })
    })
  },
})
