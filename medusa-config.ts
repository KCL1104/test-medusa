import { loadEnv, defineConfig } from '@medusajs/framework/utils'
import { Modules, ContainerRegistrationKeys } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
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
            resolve: "./src/modules/platform-auth",
            id: "platform",
            options: {
              platformApiUrl: process.env.PLATFORM_API_URL,
              clientId: process.env.PLATFORM_OAUTH_CLIENT_ID,
              clientSecret: process.env.PLATFORM_OAUTH_CLIENT_SECRET,
              callbackUrl: process.env.PLATFORM_OAUTH_CALLBACK_URL,
            },
          },
        ],
      },
    },
  ],
})
