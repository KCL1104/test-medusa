import { createChainupRefundOrder } from "../chainup-refund-order"

const fetchMock = jest.fn()

describe("createChainupRefundOrder", () => {
  beforeAll(() => {
    Object.defineProperty(global, "fetch", {
      value: fetchMock,
      writable: true,
    })
  })

  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("throws when neither openId nor userId is provided", async () => {
    await expect(
      createChainupRefundOrder({
        platformApiUrl: "https://www.star-vaults.com",
        appKey: "test_app_key",
        secretKey: "test_secret",
        appOrderId: "refund_123",
        orderAmount: "10",
        payCoinSymbol: "USDT",
      })
    ).rejects.toThrow("requires openId or userId")
  })

  it("calls ChainUp refundOrder endpoint and returns order number", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "0",
        msg: "Success",
        data: {
          orderNum: "900000001",
        },
      }),
    })

    const result = await createChainupRefundOrder({
      platformApiUrl: "https://www.star-vaults.com",
      appKey: "test_app_key",
      secretKey: "test_secret",
      appOrderId: "refund_123",
      orderAmount: "10",
      payCoinSymbol: "USDT",
      userId: "uid_777",
    })

    const [url, request] = fetchMock.mock.calls[0]
    const payload = JSON.parse(request.body)

    expect(url).toEqual("https://www.star-vaults.com/platformapi/chainup/open/opay/refundOrder")
    expect(payload.appOrderId).toEqual("refund_123")
    expect(payload.userId).toEqual("uid_777")
    expect(payload.openId).toBeUndefined()
    expect(payload.orderAmount).toEqual("10")
    expect(payload.payCoinSymbol).toEqual("USDT")
    expect(typeof payload.sign).toEqual("string")
    expect(result.orderNum).toEqual("900000001")
  })

  it("throws when ChainUp returns a non-success code", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        code: "70002",
        msg: "Order already exists",
        data: null,
      }),
    })

    await expect(
      createChainupRefundOrder({
        platformApiUrl: "https://www.star-vaults.com",
        appKey: "test_app_key",
        secretKey: "test_secret",
        appOrderId: "refund_123",
        orderAmount: "10",
        payCoinSymbol: "USDT",
        userId: "uid_777",
      })
    ).rejects.toThrow("Order already exists")
  })
})
