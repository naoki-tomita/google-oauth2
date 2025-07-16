import json from "./client_secret.json" with { type: "json" };
import { GoogleOAuth2 } from "./mod.ts";

Deno.test("should create .refreshToken file", async () => {
  try { await Deno.remove("./.refreshToken") } catch {}
  const oauth = new GoogleOAuth2({ clientId: json.client_id, clientSecret: json.client_secret });
  const token = await oauth.getAccessToken(["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/fitness.heart_rate.read"]);
  assertEqual(typeof token, "string");
  assertEqual((await Deno.readTextFile("./.refreshToken")).length, 103);
});


function assertEqual<T>(a: T, b: T) {
  if (a !== b) {
    throw Error(`Assertion failed. ${JSON.stringify(a)} is not equal to ${JSON.stringify(b)}`);
  }
}
