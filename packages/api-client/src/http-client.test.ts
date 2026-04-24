import { HttpClient, ApiError } from "./http-client";

// Minimal fetch mock
function makeFetch(status: number, body: unknown, ok = status >= 200 && status < 300) {
  return jest.fn().mockResolvedValue({
    ok,
    status,
    statusText: "OK",
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

describe("HttpClient", () => {
  const BASE = "https://api.example.com";

  afterEach(() => jest.restoreAllMocks());

  it("sends GET and returns parsed JSON", async () => {
    global.fetch = makeFetch(200, { id: "1" });
    const client = new HttpClient(BASE);
    const result = await client.get<{ id: string }>("/sessions/1");
    expect(result).toEqual({ id: "1" });
    expect(global.fetch).toHaveBeenCalledWith(
      `${BASE}/sessions/1`,
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("attaches Authorization header when token is set", async () => {
    global.fetch = makeFetch(200, {});
    const client = new HttpClient(BASE);
    client.setToken("my-jwt");
    await client.get("/sessions");
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer my-jwt");
  });

  it("throws ApiError on non-2xx response", async () => {
    global.fetch = makeFetch(401, { message: "Unauthorized" }, false);
    const client = new HttpClient(BASE);
    await expect(client.get("/sessions")).rejects.toBeInstanceOf(ApiError);
  });

  it("sends POST with JSON body", async () => {
    global.fetch = makeFetch(201, { token: "abc" });
    const client = new HttpClient(BASE);
    const result = await client.post<{ token: string }>("/auth/login", {
      email: "user@example.com",
      password: "secret",
    });
    expect(result).toEqual({ token: "abc" });
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      email: "user@example.com",
      password: "secret",
    });
  });

  it("returns empty object for 204 No Content", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      statusText: "No Content",
      json: () => Promise.reject(new Error("no body")),
      text: () => Promise.resolve(""),
    });
    const client = new HttpClient(BASE);
    const result = await client.delete("/sessions/1");
    expect(result).toEqual({});
  });
});
