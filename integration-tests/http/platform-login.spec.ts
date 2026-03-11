import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import jwt, { JwtPayload } from "jsonwebtoken"

const integrationTimeoutMs = Number(process.env.INTEGRATION_TEST_TIMEOUT_MS ?? 1800000)
jest.setTimeout(integrationTimeoutMs)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    describe("POST /auth/platform-login", () => {
      afterEach(() => {
        jest.restoreAllMocks()
      })

      it("returns OAuth location when provider requests redirect", async () => {
        const authModule = getContainer().resolve(Modules.AUTH)
        jest.spyOn(authModule, "authenticate").mockResolvedValue({
          success: true,
          location: "https://platform.example.com/login",
        })

        const response = await api.post("/auth/platform-login", {})

        expect(response.status).toEqual(200)
        expect(response.data).toEqual({
          location: "https://platform.example.com/login",
        })
      })

      it("returns 401 when provider authentication fails", async () => {
        const authModule = getContainer().resolve(Modules.AUTH)
        jest.spyOn(authModule, "authenticate").mockResolvedValue({
          success: false,
          error: "Invalid platform token",
        })

        const response = await api.post("/auth/platform-login", {
          token: "invalid",
        })

        expect(response.status).toEqual(401)
        expect(response.data).toEqual({
          message: "Invalid platform token",
        })
      })

      it("returns signed medusa token and platform uid for token login", async () => {
        const authModule = getContainer().resolve(Modules.AUTH)

        jest.spyOn(authModule, "authenticate").mockResolvedValue({
          success: true,
          authIdentity: {
            id: "auth_identity_1",
            app_metadata: {
              customer: {
                actor_id: "cus_123",
              },
            },
          },
        })

        jest.spyOn(authModule, "retrieveAuthIdentity").mockResolvedValue({
          id: "auth_identity_1",
          app_metadata: {
            customer: {
              actor_id: "cus_123",
            },
          },
          provider_identities: [
            {
              provider: "platform",
              entity_id: "uid_777",
            },
          ],
        })

        const response = await api.post("/auth/platform-login", {
          token: "exchange-token-value",
        })

        expect(response.status).toEqual(200)
        expect(response.data.platform_uid).toEqual("uid_777")
        expect(response.data.platform_token).toEqual("exchange-token-value")

        const decoded = jwt.decode(response.data.token) as JwtPayload

        expect(decoded).toMatchObject({
          actor_id: "cus_123",
          actor_type: "customer",
          auth_identity_id: "auth_identity_1",
        })
      })
    })

    describe("GET /auth/platform-login?code=...", () => {
      afterEach(() => {
        jest.restoreAllMocks()
      })

      it("returns signed medusa token and platform uid for callback login", async () => {
        const authModule = getContainer().resolve(Modules.AUTH)

        jest.spyOn(authModule, "validateCallback").mockResolvedValue({
          success: true,
          authIdentity: {
            id: "auth_identity_2",
            app_metadata: {
              customer: {
                actor_id: "cus_456",
              },
            },
          },
        })

        jest.spyOn(authModule, "retrieveAuthIdentity").mockResolvedValue({
          id: "auth_identity_2",
          app_metadata: {
            customer: {
              actor_id: "cus_456",
            },
          },
          provider_identities: [
            {
              provider: "platform",
              entity_id: "uid_888",
            },
          ],
        })

        const response = await api.get("/auth/platform-login?code=oauth-code")

        expect(response.status).toEqual(200)
        expect(response.data.platform_uid).toEqual("uid_888")
        expect(response.data.platform_token).toBeUndefined()

        const decoded = jwt.decode(response.data.token) as JwtPayload

        expect(decoded).toMatchObject({
          actor_id: "cus_456",
          actor_type: "customer",
          auth_identity_id: "auth_identity_2",
        })
      })

      it("returns 401 when callback validation fails", async () => {
        const authModule = getContainer().resolve(Modules.AUTH)

        jest.spyOn(authModule, "validateCallback").mockResolvedValue({
          success: false,
          error: "Missing authorization code",
        })

        const response = await api.get("/auth/platform-login?code=bad-code")

        expect(response.status).toEqual(401)
        expect(response.data).toEqual({
          message: "Missing authorization code",
        })
      })
    })
  },
})
