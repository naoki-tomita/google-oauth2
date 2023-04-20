# GoogleOauth2 client for deno.

## how to use

```ts
import { GoogleOAuth2 } from "https://raw.githubusercontent.com/naoki-tomita/google-oauth2/master/mod.ts";

const client = new GoogleOAuth2({
  clientId: "xxxxx-dummy-client-id",
  clientSecret: "yyyyy-dummy-client-secret",
});

// The authorization screen will open in browser.
// If the user authorizes, an access token is obtained.
// A refresh token file is generated, and the file is used to generate access tokens for the second and subsequent times.
const accessToken = await client.getAccessToken(["accessTokenScope1",...]);
```
