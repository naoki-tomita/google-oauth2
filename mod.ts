function queryString(obj: { [key: string]: string }) {
  return Object.entries(obj).reduce(
    (
      prev,
      [k, v],
    ) => (`${prev}&${encodeURIComponent(k)}=${encodeURIComponent(v)}`),
    "",
  ).replace("&", "");
}

export class GoogleOAuth2 {
  constructor(
    readonly opt: {
      clientId: string;
      clientSecret: string;
    },
  ) {}

  buildUrl(scopes: string[]) {
    return `https://accounts.google.com/o/oauth2/auth?${
      queryString({
        client_id: this.opt.clientId,
        redirect_uri: "http://localhost:8080",
        scope: scopes.join(" "),
        response_type: "code",
        access_type: "offline"
      })
    }`;
  }

  getAccessTokenByRefreshToken(
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

  getAccessTokenByCode(
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

  async getAccessToken(scopes: string[]) {
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

  async readRequest(connection: Deno.Conn) {
    const buf = new Uint8Array(4096);
    await connection.read(buf) ?? 0; // 最後まで読み取ったあと、無限にawaitしちゃうのをどうにかしたい
    return new TextDecoder().decode(buf);
  }

  async waitForCode() {
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
