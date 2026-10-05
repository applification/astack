import type { AuthConfig } from "convex/server";
export default {
  providers: [
    {
      type: "customJwt",
      issuer:
        process.env.OBSERVATORY_AUTH_ISSUER ??
        "https://otis.tail12a0a0.ts.net:8452",
      applicationID: "astack-observatory",
      algorithm: "RS256",
      jwks:
        process.env.OBSERVATORY_JWKS_URI ??
        "data:application/json;base64,eyJrZXlzIjpbXX0=",
    },
  ],
} satisfies AuthConfig;
