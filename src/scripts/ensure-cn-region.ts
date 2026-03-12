import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createRegionsWorkflow,
  createTaxRegionsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"

const CN_COUNTRY_CODE = "cn"
const CN_REGION_NAME = "China"
const CN_CURRENCY_CODE = "cny"
const CN_TAX_PROVIDER_ID = "tp_system"
const CN_PAYMENT_PROVIDERS = ["pp_system_default", "pp_chainup_platform"]

type StoreCurrency = {
  currency_code?: string | null
  is_default?: boolean | null
}

type StoreQueryResult = {
  id: string
  supported_currencies?: (StoreCurrency | null)[] | null
}

type RegionCountry = {
  iso_2?: string | null
}

type RegionQueryResult = {
  id: string
  name?: string | null
  currency_code?: string | null
  countries?: (RegionCountry | null)[] | null
}

type TaxRegionQueryResult = {
  id: string
  country_code?: string | null
}

const normalizeStoreCurrencies = (currencies: StoreQueryResult["supported_currencies"]) => {
  const normalized = new Map<string, { currency_code: string; is_default?: boolean }>()

  for (const currency of currencies ?? []) {
    const code = currency?.currency_code?.toLowerCase()
    if (!code) {
      continue
    }

    normalized.set(code, {
      currency_code: code,
      ...(currency?.is_default ? { is_default: true } : {}),
    })
  }

  return Array.from(normalized.values())
}

const hasCountryCode = (region: RegionQueryResult, countryCode: string): boolean => {
  return (
    region.countries?.some(
      (country) => country?.iso_2?.toLowerCase() === countryCode.toLowerCase()
    ) ?? false
  )
}

export default async function ensureCnRegion({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: storesData } = await query.graph({
    entity: "store",
    fields: ["id", "supported_currencies.currency_code", "supported_currencies.is_default"],
  })

  const stores = storesData as StoreQueryResult[]

  if (!stores.length) {
    throw new Error("No store found. Cannot ensure CN region without a store.")
  }

  const store = stores[0]
  const supportedCurrencies = normalizeStoreCurrencies(store.supported_currencies)

  if (!supportedCurrencies.some((currency) => currency.currency_code === CN_CURRENCY_CODE)) {
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: store.id },
        update: {
          supported_currencies: [
            ...supportedCurrencies,
            {
              currency_code: CN_CURRENCY_CODE,
              is_default: false,
            },
          ],
        },
      },
    })

    logger.info(`Added ${CN_CURRENCY_CODE.toUpperCase()} to store supported currencies.`)
  } else {
    logger.info(`Store already supports ${CN_CURRENCY_CODE.toUpperCase()}.`)
  }

  const { data: regionData } = await query.graph({
    entity: "region",
    fields: ["id", "name", "currency_code", "countries.iso_2"],
  })

  const regions = regionData as RegionQueryResult[]
  const existingCnRegion = regions.find((region) => hasCountryCode(region, CN_COUNTRY_CODE))

  if (existingCnRegion) {
    logger.info(
      `CN country already mapped to region ${existingCnRegion.id} (${existingCnRegion.name ?? "Unnamed"}).`
    )

    if (existingCnRegion.currency_code?.toLowerCase() !== CN_CURRENCY_CODE) {
      logger.warn(
        `CN region currency is ${existingCnRegion.currency_code}. Expected ${CN_CURRENCY_CODE}.`
      )
    }
  } else {
    const { result: createdRegions } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: CN_REGION_NAME,
            currency_code: CN_CURRENCY_CODE,
            countries: [CN_COUNTRY_CODE],
            payment_providers: CN_PAYMENT_PROVIDERS,
          },
        ],
      },
    })

    logger.info(
      `Created CN region ${createdRegions[0].id} (${createdRegions[0].name ?? CN_REGION_NAME}).`
    )
  }

  const { data: taxRegionData } = await query.graph({
    entity: "tax_region",
    fields: ["id", "country_code"],
    filters: {
      country_code: CN_COUNTRY_CODE,
    },
  })

  const taxRegions = taxRegionData as TaxRegionQueryResult[]

  if (taxRegions.length) {
    logger.info(`Tax region for ${CN_COUNTRY_CODE.toUpperCase()} already exists.`)
  } else {
    await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: CN_COUNTRY_CODE,
          provider_id: CN_TAX_PROVIDER_ID,
        },
      ],
    })

    logger.info(`Created tax region for ${CN_COUNTRY_CODE.toUpperCase()}.`)
  }

  logger.info("CN region ensure script completed.")
}
