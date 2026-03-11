import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import {
  createProductsWorkflow,
  createSalesChannelsWorkflow,
  createShippingProfilesWorkflow,
} from "@medusajs/medusa/core-flows"

const ZERO_PRICE_PRODUCT_HANDLE = "zero-price-test-product"
const ZERO_PRICE_PRODUCT_SKU = "ZERO-PRICE-TEST-DEFAULT"

export default async function createZeroPriceProduct({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)

  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "title", "handle"],
    filters: {
      handle: ZERO_PRICE_PRODUCT_HANDLE,
    },
  })

  if (existingProducts.length) {
    logger.info(
      `Zero-price test product already exists (handle: ${ZERO_PRICE_PRODUCT_HANDLE}). Skipping creation.`
    )
    return
  }

  let defaultSalesChannel = await salesChannelModuleService.listSalesChannels({
    name: "Default Sales Channel",
  })

  if (!defaultSalesChannel.length) {
    const { result: createdSalesChannels } = await createSalesChannelsWorkflow(container).run({
      input: {
        salesChannelsData: [
          {
            name: "Default Sales Channel",
          },
        ],
      },
    })

    defaultSalesChannel = createdSalesChannels
  }

  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null

  if (!shippingProfile) {
    const { result: createdShippingProfiles } = await createShippingProfilesWorkflow(
      container
    ).run({
      input: {
        data: [
          {
            name: "Default Shipping Profile",
            type: "default",
          },
        ],
      },
    })

    shippingProfile = createdShippingProfiles[0]
  }

  const { result: createdProducts } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Zero Price Test Product",
          handle: ZERO_PRICE_PRODUCT_HANDLE,
          description: "A zero-price product used to test checkout and payment flows.",
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [
            {
              title: "Type",
              values: ["Default"],
            },
          ],
          variants: [
            {
              title: "Default",
              sku: ZERO_PRICE_PRODUCT_SKU,
              manage_inventory: false,
              options: {
                Type: "Default",
              },
              prices: [
                {
                  amount: 0,
                  currency_code: "eur",
                },
                {
                  amount: 0,
                  currency_code: "usd",
                },
              ],
            },
          ],
          sales_channels: [
            {
              id: defaultSalesChannel[0].id,
            },
          ],
        },
      ],
    },
  })

  const createdProduct = createdProducts[0]
  logger.info(
    `Created zero-price test product: ${createdProduct.title} (id: ${createdProduct.id}, handle: ${createdProduct.handle})`
  )
}
