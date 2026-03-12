import { PaymentActions, PaymentSessionStatus } from "@medusajs/framework/utils"
import PlatformPaymentService from "../service"
import { generateChainupSign } from "../../../utils/chainup-sign"

const fetchMock = jest.fn()

describe("PlatformPaymentService", () => {
  const options = {
    platformApiUrl: "https://www.star-vaults.com",
    appKey: "test_app_key",
    secretKey: "test_secret",
    payCoinSymbol: "USDT",
    returnPage: "https://www.star-vaults.com/pay-return",
    notifyPage: "https://api.star-vaults.com/hooks/payment/chainup",
    openId: "",
  }

  beforeAll(() => {
    Object.defineProperty(global, "fetch", {
      value: fetchMock,
      writable: true,
    })
  })

  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("throws when session_id is missing during payment initialization", async () => {
    const service = new PlatformPaymentService({ logger: console as any }, options)

    await expect(
      service.initiatePayment({
        amount: "12.5",
        currency_code: "usd",
        data: {
          platform_uid: "uid_777",
        },
      })
    ).rejects.toThrow("Missing session_id")
  })

  it("throws when platform uid is missing during payment initialization", async () => {
    const service = new PlatformPaymentService({ logger: console as any }, options)

    await expect(
      service.initiatePayment({
        amount: "12.5",
        currency_code: "usd",
        data: {
          session_id: "payses_123",
        },
      })
    ).rejects.toThrow("Missing platform uid")
  })

  it("creates ChainUp order with userId when openId is empty", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "0",
        msg: "Success",
        data: {
          orderNum: "100000001",
          sign: "provider-sign",
        },
      }),
    })

    const service = new PlatformPaymentService({ logger: console as any }, options)
    const result = await service.initiatePayment({
      amount: "12.5",
      currency_code: "usd",
      data: {
        session_id: "payses_123",
        platform_uid: "uid_777",
      },
    })

    expect(result.id).toEqual("100000001")
    expect(result.status).toEqual(PaymentSessionStatus.PENDING)
    expect(result.data?.pay_page_url).toContain("/platform/pay.html")
    expect(result.data?.pay_page_url).toContain("orderNum=100000001")
    expect(result.data?.pay_page_url).toContain("appKey=test_app_key")
    expect(result.data?.return_page).toEqual("https://www.star-vaults.com/pay-return")

    const [url, request] = fetchMock.mock.calls[0]
    const payload = JSON.parse(request.body)

    expect(url).toEqual("https://www.star-vaults.com/platformapi/chainup/open/opay/createThirdOrder")
    expect(payload.appOrderId).toEqual("payses_123")
    expect(payload.openId).toBeUndefined()
    expect(payload.userId).toEqual("uid_777")
    expect(payload.payCoinSymbol).toEqual("USDT")
    expect(typeof payload.sign).toEqual("string")
  })

  it("uses openId and strips query params from returnPage", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "0",
        msg: "Success",
        data: {
          orderNum: "100000002",
          sign: "provider-sign",
        },
      }),
    })

    const service = new PlatformPaymentService({ logger: console as any }, options)
    const result = await service.initiatePayment({
      amount: "12.5",
      currency_code: "usd",
      data: {
        session_id: "payses_456",
        platform_uid: "uid_888",
        open_id: "open_123",
        return_page:
          "https://www.star-vaults.com/tw/checkout?step=review&chainup_return=1",
      },
    })

    const [url, request] = fetchMock.mock.calls[0]
    const payload = JSON.parse(request.body)

    expect(url).toEqual("https://www.star-vaults.com/platformapi/chainup/open/opay/createThirdOrder")
    expect(payload.appOrderId).toEqual("payses_456")
    expect(payload.openId).toEqual("open_123")
    expect(payload.userId).toBeUndefined()
    expect(payload.returnPage).toEqual("https://www.star-vaults.com/tw/checkout")
    expect(result.data?.return_page).toEqual("https://www.star-vaults.com/tw/checkout")
    expect(result.data?.pay_page_url).toContain("openId=open_123")
    expect(result.data?.pay_page_url).not.toContain("userId=")
  })

  it("maps orderDetail success to captured payment status", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 0,
        data: {
          orderNum: "100000001",
          appOrderId: "payses_123",
          orderStatus: "3",
          orderAmount: "12.5",
          payCoinSymbol: "USDT",
          userId: "uid_777",
        },
      }),
    })

    const service = new PlatformPaymentService({ logger: console as any }, options)
    const result = await service.getPaymentStatus({
      data: {
        order_num: "100000001",
      },
    })

    expect(result.status).toEqual(PaymentSessionStatus.CAPTURED)
    expect(result.data?.order_status).toEqual("3")
  })

  it.each([
    ["1", PaymentSessionStatus.PENDING],
    ["2", PaymentSessionStatus.ERROR],
    ["0", PaymentSessionStatus.CANCELED],
  ])(
    "maps orderDetail status %s to payment session status",
    async (orderStatus, expectedStatus) => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          code: 0,
          data: {
            orderNum: "100000001",
            appOrderId: "payses_123",
            orderStatus,
            orderAmount: "12.5",
            payCoinSymbol: "USDT",
            userId: "uid_777",
          },
        }),
      })

      const service = new PlatformPaymentService({ logger: console as any }, options)
      const result = await service.getPaymentStatus({
        data: {
          order_num: "100000001",
        },
      })

      expect(result.status).toEqual(expectedStatus)
      expect(result.data?.order_status).toEqual(orderStatus)
    }
  )

  it("verifies webhook signature and maps success action", async () => {
    const body = {
      appKey: "test_app_key",
      outOrderId: "payses_123",
      orderStatus: "3",
      payAmount: "12.5",
    }
    const sign = generateChainupSign(body, "test_secret")
    const service = new PlatformPaymentService({ logger: console as any }, options)

    const result = await service.getWebhookActionAndData({
      data: {
        ...body,
        sign,
      },
      headers: {},
      rawData: "",
    })

    expect(result.action).toEqual(PaymentActions.SUCCESSFUL)
    expect(result.data?.session_id).toEqual("payses_123")
  })

  it("accepts uppercase webhook signatures", async () => {
    const body = {
      appKey: "test_app_key",
      outOrderId: "payses_123",
      orderStatus: "3",
      payAmount: "12.5",
    }
    const sign = generateChainupSign(body, "test_secret").toUpperCase()
    const service = new PlatformPaymentService({ logger: console as any }, options)

    const result = await service.getWebhookActionAndData({
      data: {
        ...body,
        sign,
      },
      headers: {},
      rawData: "",
    })

    expect(result.action).toEqual(PaymentActions.SUCCESSFUL)
  })

  it.each([
    ["1", PaymentActions.REQUIRES_MORE],
    ["2", PaymentActions.FAILED],
    ["0", PaymentActions.CANCELED],
    ["3", PaymentActions.SUCCESSFUL],
  ])("maps webhook orderStatus %s to %s action", async (orderStatus, action) => {
    const body = {
      appKey: "test_app_key",
      outOrderId: "payses_123",
      orderStatus,
      payAmount: "12.5",
    }
    const sign = generateChainupSign(body, "test_secret")
    const service = new PlatformPaymentService({ logger: console as any }, options)

    const result = await service.getWebhookActionAndData({
      data: {
        ...body,
        sign,
      },
      headers: {},
      rawData: "",
    })

    expect(result.action).toEqual(action)
  })

  it("marks webhook as failed when signature is invalid", async () => {
    const service = new PlatformPaymentService({ logger: console as any }, options)

    const result = await service.getWebhookActionAndData({
      data: {
        appKey: "test_app_key",
        outOrderId: "payses_123",
        orderStatus: "3",
        payAmount: "12.5",
        sign: "invalid-sign",
      },
      headers: {},
      rawData: "",
    })

    expect(result.action).toEqual(PaymentActions.FAILED)
  })
})
