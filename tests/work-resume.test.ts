import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ permission: vi.fn(), drain: vi.fn(), sync: vi.fn(), stores: new Map<string, Map<string, { data: unknown; etag: string }>>() }));
vi.mock("@netlify/blobs", () => ({ getStore: ({name}: {name:string}) => {
  if (!mock.stores.has(name)) mock.stores.set(name,new Map());
  const entries = mock.stores.get(name)!;
  return {
    getWithMetadata: async (key:string) => structuredClone(entries.get(key) ?? null),
    get: async (key:string) => structuredClone(entries.get(key)?.data ?? null),
    setJSON: async (key:string,data:unknown,options:{onlyIfMatch?:string;onlyIfNew?:boolean}) => {
      const current = entries.get(key);
      if ((options.onlyIfNew && current) || (options.onlyIfMatch && current?.etag !== options.onlyIfMatch)) return {modified:false};
      const etag = String(Number(current?.etag ?? 0)+1); entries.set(key,{data,etag}); return {modified:true,etag};
    },
    list: async function*() { yield { blobs: [...entries.keys()].map(key=>({key})) }; },
  };
}}));
vi.mock("../netlify/functions/lib/work-switch.js",()=>({workPermission:mock.permission}));
vi.mock("../netlify/functions/lib/work-inbox-drain.js",()=>({drainWorkInbox:mock.drain}));
vi.mock("../netlify/functions/lib/automation/shortcut-sync.js",()=>({runAutomaticShortcutSync:mock.sync}));
import { clientWorkPermission, resumeAutomaticWork } from "../netlify/functions/lib/work-resume.js";
beforeEach(()=>{mock.stores.clear();vi.clearAllMocks();mock.permission.mockResolvedValue({configured:true,state:"active",revision:1,leaseSeconds:60});mock.drain.mockResolvedValue(true);mock.sync.mockResolvedValue({});});
afterEach(()=>vi.restoreAllMocks());
it("concurrent catch-up requests admit one worker and reuse completed revision",async()=>{
  await Promise.all([resumeAutomaticWork(),resumeAutomaticWork()]);
  expect(mock.sync).toHaveBeenCalledTimes(1);expect(mock.drain).toHaveBeenCalledTimes(1);
  expect((await clientWorkPermission()).catchUpPending).toBe(false);
  await resumeAutomaticWork();expect(mock.sync).toHaveBeenCalledTimes(1);
});
it("failed replay stays pending and releases the lock for retry",async()=>{
  mock.drain.mockRejectedValueOnce(new Error("provider down"));
  await expect(resumeAutomaticWork()).rejects.toThrow("provider down");
  expect((await clientWorkPermission()).catchUpPending).toBe(true);
  await resumeAutomaticWork();expect(mock.sync).toHaveBeenCalledOnce();
});
it("turning off during replay prevents source catch-up",async()=>{
  mock.permission.mockResolvedValueOnce({configured:true,state:"active",revision:1,leaseSeconds:60}).mockResolvedValue({configured:true,state:"standby",revision:2,leaseSeconds:0});
  await resumeAutomaticWork();expect(mock.sync).not.toHaveBeenCalled();
});
it("a bounded partial batch does not report completed catch-up",async()=>{
  mock.drain.mockResolvedValue(false);await resumeAutomaticWork();expect((await clientWorkPermission()).catchUpPending).toBe(true);
});
