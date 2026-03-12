import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import { Modules, ContainerRegistrationKeys } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  modules: [
    {
      resolve: "@medusajs/medusa/auth",
      dependencies: [Modules.CACHE, ContainerRegistrationKeys.LOGGER],
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/auth-emailpass",
            id: "emailpass",
          },
          {
            resolve: "./src/modules/platform-auth",
            id: "platform",
            options: {
              platformApiUrl: process.env.PLATFORM_API_URL,
              appKey: process.env.PLATFORM_APP_KEY,
              secretKey: process.env.PLATFORM_SECRET_KEY,
              callbackUrl: process.env.PLATFORM_OAUTH_CALLBACK_URL,
            },
          },
        ],
      },
    },
    {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "./src/modules/platform-payment",
            id: "platform",
            options: {
              platformApiUrl: process.env.PLATFORM_API_URL,
              appKey: process.env.PLATFORM_APP_KEY,
              secretKey: process.env.PLATFORM_SECRET_KEY,
              payCoinSymbol: process.env.CHAINUP_PAY_COIN_SYMBOL || "USDT",
              returnPage:
                process.env.CHAINUP_PAYMENT_RETURN_PAGE ||
                "https://www.star-vaults.com/zh_TC/register?inviteCode=WZVVTAQE",
              notifyPage:
                process.env.CHAINUP_PAYMENT_NOTIFY_PAGE ||
                "http://localhost:9000/hooks/payment/chainup",
              orderSceneType: process.env.CHAINUP_ORDER_SCENE_TYPE,
              openId: "",
            },
          },
        ],
      },
    },
    {
      resolve: "./src/modules/chainup-audit",
    },
  ],
})
