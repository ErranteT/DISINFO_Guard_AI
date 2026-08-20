import { lookup as dnsLookup } from "node:dns/promises";
import { isIP } from "node:net";
import { SafeFetchError } from "./errors.ts";

export type ResolvedAddress = { address: string; family: 4 | 6 };
export type ResolveHostname = (hostname: string) => Promise<ResolvedAddress[]>;

function ipv4Number(address: string): number | null {
  const parts = address.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map(Number);
  if (octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return null;
  return (((octets[0] * 256 + octets[1]) * 256 + octets[2]) * 256 + octets[3]) >>> 0;
}

function inV4Cidr(value: number, base: string, prefix: number): boolean {
  const baseValue = ipv4Number(base)!;
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (value & mask) === (baseValue & mask);
}

function isPublicIpv4(address: string): boolean {
  const value = ipv4Number(address);
  if (value === null) return false;
  const blocked: Array<[string, number]> = [
    ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8],
    ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24],
    ["192.88.99.0", 24],
    ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24],
    ["224.0.0.0", 4], ["240.0.0.0", 4],
  ];
  return !blocked.some(([base, prefix]) => inV4Cidr(value, base, prefix));
}

function expandIpv6(address: string): number[] | null {
  const zoneIndex = address.indexOf("%");
  const raw = (zoneIndex === -1 ? address : address.slice(0, zoneIndex)).toLowerCase();
  const halves = raw.split("::");
  if (halves.length > 2) return null;
  const parseHalf = (half: string): number[] | null => {
    if (!half) return [];
    const result: number[] = [];
    for (const item of half.split(":")) {
      if (item.includes(".")) {
        const v4 = ipv4Number(item);
        if (v4 === null) return null;
        result.push((v4 >>> 16) & 0xffff, v4 & 0xffff);
      } else if (!/^[0-9a-f]{1,4}$/.test(item)) return null;
      else result.push(Number.parseInt(item, 16));
    }
    return result;
  };
  const left = parseHalf(halves[0]);
  const right = parseHalf(halves[1] ?? "");
  if (!left || !right) return null;
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;
  return [...left, ...Array(missing).fill(0), ...right];
}

function isPublicIpv6(address: string): boolean {
  const groups = expandIpv6(address);
  if (!groups) return false;
  const mapped = groups.slice(0, 5).every((part) => part === 0) && groups[5] === 0xffff;
  if (mapped) {
    const v4 = `${groups[6] >>> 8}.${groups[6] & 255}.${groups[7] >>> 8}.${groups[7] & 255}`;
    return isPublicIpv4(v4);
  }
  // Course MVP accepts globally routable unicast space only and excludes documentation.
  const globalUnicast = (groups[0] & 0xe000) === 0x2000;
  const protocolAssignments = groups[0] === 0x2001 && groups[1] <= 0x01ff;
  const documentation = groups[0] === 0x2001 && groups[1] === 0x0db8;
  const deprecated6to4 = groups[0] === 0x2002;
  const additionalDocumentation = groups[0] >= 0x3fff && groups[0] <= 0x3fff;
  const segmentRouting = groups[0] === 0x5f00;
  return globalUnicast && !protocolAssignments && !documentation && !deprecated6to4
    && !additionalDocumentation && !segmentRouting;
}

export function isPublicIp(address: string): boolean {
  const family = isIP(address);
  return family === 4 ? isPublicIpv4(address) : family === 6 ? isPublicIpv6(address) : false;
}

export const resolveHostname: ResolveHostname = async (hostname) => {
  const results = await dnsLookup(hostname, { all: true, verbatim: true });
  return results.map(({ address, family }) => ({ address, family: family as 4 | 6 }));
};

export async function resolveSafeTarget(
  url: URL,
  resolver: ResolveHostname = resolveHostname,
): Promise<ResolvedAddress> {
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const literalFamily = isIP(hostname);
  if (literalFamily) {
    if (!isPublicIp(hostname)) throw new SafeFetchError("UNSAFE_TARGET");
    return { address: hostname, family: literalFamily as 4 | 6 };
  }

  let addresses: ResolvedAddress[];
  try {
    addresses = await resolver(hostname);
  } catch {
    throw new SafeFetchError("DNS_RESOLUTION_FAILED");
  }
  if (addresses.length === 0) throw new SafeFetchError("DNS_RESOLUTION_FAILED");
  if (addresses.some(({ address, family }) => isIP(address) !== family || !isPublicIp(address))) {
    throw new SafeFetchError("UNSAFE_TARGET");
  }
  return addresses[0];
}
