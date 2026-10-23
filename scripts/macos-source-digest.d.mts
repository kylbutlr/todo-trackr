export type NativeSourceDigest = {
  algorithm: "sha256";
  digest: string;
  files: string[];
};

export function nativeSourceDigest(): Promise<NativeSourceDigest>;
