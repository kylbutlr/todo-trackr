import { afterEach, expect, it, vi } from "vitest";
const database = vi.hoisted(()=>vi.fn(()=>{throw new Error("State endpoint must not touch Neon");}));
vi.mock("../netlify/functions/lib/database.js",()=>({database}));
import api from "../netlify/functions/api.mjs";
import { createSessionToken } from "../netlify/functions/lib/auth.js";
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();database.mockClear();});
it("authenticates control-state reads without querying Neon",async()=>{
  vi.stubEnv("SESSION_SIGNING_SECRET","test-only-signing-secret-with-enough-characters");
  vi.stubEnv("APP_SWITCHR_URL","https://switch.test/api/work-state");
  vi.stubEnv("APP_SWITCHR_READER_TOKEN","test-reader");
  const fetcher=vi.fn().mockResolvedValue(Response.json({state:"standby",revision:3,leaseSeconds:0}));
  vi.stubGlobal("fetch",fetcher);
  expect((await api(new Request("https://todo.test/api/work-state"))).status).toBe(401);
  expect(fetcher).not.toHaveBeenCalled();
  const token=await createSessionToken();
  const response=await api(new Request("https://todo.test/api/work-state",{headers:{authorization:`Bearer ${token}`}}));
  expect(response.status).toBe(200);expect(await response.json()).toMatchObject({state:"standby",revision:3,catchUpPending:false});
  expect(database).not.toHaveBeenCalled();
});
