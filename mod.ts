function queryString(obj: { [key: string]: string }) {
  return Object.entries(obj).reduce(
    (
      prev,
      [k, v],
    ) => (`${prev}&${encodeURIComponent(k)}=${encodeURIComponent(v)}`),
    "",
  ).replace("&", "");
}

/**
 * Google OAuth2 client for Deno.
 */
export class GoogleOAuth2 {
  constructor(
    readonly opt: {
      clientId: string;
      clientSecret: string;
    },
  ) {}

  private buildUrl(scopes: string[]) {
    return `https://accounts.google.com/o/oauth2/auth?${
      new URLSearchParams({
        client_id: this.opt.clientId,
        redirect_uri: "http://localhost:8080",
        scope: scopes.join(" "),
        response_type: "code",
        access_type: "offline"
      }).toString()
    }`;
  }

  private getAccessTokenByRefreshToken(
    refreshToken: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    return fetch("https://www.googleapis.com/oauth2/v4/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: queryString({
        client_id: this.opt.clientId,
        client_secret: this.opt.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    })
      .then((it) => it.json());
  }

  private getAccessTokenByCode(
    code: string,
  ): Promise<{ access_token: string; refresh_token: string }> {
    return fetch("https://accounts.google.com/o/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: queryString({
        code: code,
        client_id: this.opt.clientId,
        client_secret: this.opt.clientSecret,
        redirect_uri: "http://localhost:8080",
        grant_type: "authorization_code",
      }),
    }).then((it) => it.json());
  }

  /**
   * Get access token from Google OAuth2.
   * This method will open a browser window to request user authorization.
   * If the user has already authorized the application, it will use the refresh token stored in `.refreshToken` file.
   * If the file does not exist, it will request the user to authorize the application and store the refresh token in `.refreshToken`.
   * `.refreshToken` file should be created in the current working directory.
   * `.refreshToken` file should not be committed to the repository. To avoid this, you can add `.refreshToken` to your `.gitignore` file.
   * @param scopes The scopes to request.
   * @returns The access token.
   */
  async getAccessToken(scopes: string[]): Promise<string> {
    try {
      return await Deno.readTextFile(".refreshToken")
        .then((it) => this.getAccessTokenByRefreshToken(it))
        .then((it) => it.access_token);
    } catch {
      const link = this.buildUrl(scopes);
      const os = Deno.build.os;
      const proc = new Deno.Command(os === "darwin" ? "open" : "xdg-open", { args:[link] });
      const promise = proc.output();
      const response = await this.waitForCode();
      await promise;

      const token = await this.getAccessTokenByCode(response.code);
      await Deno.writeTextFile(".refreshToken", token.refresh_token);
      return token.access_token;
    }
  }

  private async readRequest(connection: Deno.Conn) {
    const buf = new Uint8Array(4096);
    await connection.read(buf) ?? 0; // 最後まで読み取ったあと、無限にawaitしちゃうのをどうにかしたい
    return new TextDecoder().decode(buf);
  }

  private async waitForCode() {
    const listener = Deno.listen({ port: 8080 });
    const connection = await listener.accept();
    listener.close();

    const httpRequest = await this.readRequest(connection);
    const head = httpRequest.split("\r\n")[0];
    const result = /GET (.+) HTTP\/1.1/.exec(head);
    const url = result![1];

    const queries = url?.split("?")[1].split("&").map((it) => it.split("=")).reduce(
      (prev, [k, v]) => ({ ...prev, [k]: v }),
      {} as { code: string },
    );

    await new Promise(ok => setTimeout(ok, 0)); // wait for next tick for flush http response.
    const res = new TextEncoder().encode(HttpResponse);
    await connection.write(res);
    connection.close();
    return queries;
  }
}


const HttpResponse = `
HTTP/1.1 200 OK
Content-Length: 30

You can close this window now.
`.trim().replace("\n", "\r\n")
