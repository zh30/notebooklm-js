import {
  RPCError,
  RateLimitError,
} from "../core/exceptions";

export enum RPCErrorCode {
  UNKNOWN = 0,
  INVALID_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  RATE_LIMITED = 429,
  SERVER_ERROR = 500,
}

const ERROR_CODE_MESSAGES: Record<number, [string, boolean]> = {
  [RPCErrorCode.INVALID_REQUEST]: ["Invalid request parameters. Check your input and try again.", false],
  [RPCErrorCode.UNAUTHORIZED]: ["Authentication required. Run 'notebooklm login' to re-authenticate.", false],
  [RPCErrorCode.FORBIDDEN]: ["Insufficient permissions for this operation.", false],
  [RPCErrorCode.NOT_FOUND]: ["Requested resource not found.", false],
  [RPCErrorCode.RATE_LIMITED]: ["API rate limit exceeded. Please wait before retrying.", true],
  [RPCErrorCode.SERVER_ERROR]: ["Server error occurred. This is usually temporary - try again later.", true],
};

export function getErrorMessageForCode(code: number | null): [string, boolean] {
  if (code === null) return ["Unknown error occurred.", false];
  if (ERROR_CODE_MESSAGES[code]) return ERROR_CODE_MESSAGES[code];
  if (code >= 400 && code < 500) return [`Client error ${code}. Check your request parameters.`, false];
  if (code >= 500 && code < 600) return [`Server error ${code}. This is usually temporary - try again later.`, true];
  return [`Error code: ${code}`, false];
}

export function stripAntiXssi(response: string): string {
  if (response.startsWith(")]}'")) {
    const match = response.match(/\)]\}'\r?\n/);
    if (match && match.index !== undefined) {
      return response.substring(match.index! + match[0].length);
    }
  }
  return response;
}

export function parseChunkedResponse(response: string): any[] {
  if (!response || !response.trim()) return [];

  const chunks: any[] = [];
  const lines = response.trim().split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    if (!isNaN(Number(line))) {
      i++;
      if (i < lines.length) {
        try {
          chunks.push(JSON.parse(lines[i]!));
        } catch (e) {
          console.warn(`Skipping malformed chunk at line ${i + 1}`);
        }
      }
      i++;
    } else {
      try {
        chunks.push(JSON.parse(line));
      } catch (e) {
        console.warn(`Skipping non-JSON line at ${i + 1}`);
      }
      i++;
    }
  }
  return chunks;
}

function containsUserDisplayableError(obj: any): boolean {
  if (typeof obj === "string") return obj.includes("UserDisplayableError");
  if (Array.isArray(obj)) return obj.some(containsUserDisplayableError);
  if (typeof obj === "object" && obj !== null) return Object.values(obj).some(containsUserDisplayableError);
  return false;
}

export function collectRpcIds(chunks: any[]): string[] {
  const foundIds: string[] = [];
  for (const chunk of chunks) {
    if (!Array.isArray(chunk)) continue;

    const items = (chunk.length > 0 && Array.isArray(chunk[0])) ? chunk : [chunk];

    for (const item of items) {
      if (!Array.isArray(item) || item.length < 2) continue;

      if ((item[0] === "wrb.fr" || item[0] === "er") && typeof item[1] === "string") {
        foundIds.push(item[1]);
      }
    }
  }
  return foundIds;
}

export function extractRpcResult(chunks: any[], rpcId: string): any {
  for (const chunk of chunks) {
    if (!Array.isArray(chunk)) continue;

    const items = (chunk.length > 0 && Array.isArray(chunk[0])) ? chunk : [chunk];

    for (const item of items) {
      if (!Array.isArray(item) || item.length < 3) continue;

      if (item[0] === "er" && item[1] === rpcId) {
        const errorCode = item.length > 2 ? item[2] : null;
        let errorMsg = "Unknown error";

        if (typeof errorCode === "number") {
          const [msg] = getErrorMessageForCode(errorCode);
          errorMsg = msg;
        } else if (errorCode) {
          errorMsg = String(errorCode);
        }

        throw new RPCError(errorMsg, { methodId: rpcId, rpcCode: errorCode });
      }

      if (item[0] === "wrb.fr" && item[1] === rpcId) {
        const resultData = item[2];

        // Check for embedded UserDisplayableError when result is null
        if (resultData === null && item.length > 5 && item[5] !== null) {
          if (containsUserDisplayableError(item[5])) {
            throw new RateLimitError("API rate limit or quota exceeded. Please wait before retrying.", {
              methodId: rpcId,
              rpcCode: "USER_DISPLAYABLE_ERROR",
            });
          }
        }

        if (typeof resultData === "string") {
          try {
            return JSON.parse(resultData);
          } catch {
            return resultData;
          }
        }
        return resultData;
      }
    }
  }
  return null;
}

export function decodeResponse(rawResponse: string, rpcId: string, allowNull = false): any {
  const cleaned = stripAntiXssi(rawResponse);
  const chunks = parseChunkedResponse(cleaned);
  const foundIds = collectRpcIds(chunks);

  try {
    const result = extractRpcResult(chunks, rpcId);
    
    if (result === null && !allowNull) {
        if (foundIds.length > 0 && !foundIds.includes(rpcId)) {
            throw new RPCError(
                `No result found for RPC ID '${rpcId}'. Response contains IDs: ${foundIds.join(", ")}. The RPC method ID may have changed.`,
                { methodId: rpcId, foundIds, rawResponse: cleaned }
            );
        }
        throw new RPCError(`No result found for RPC ID: ${rpcId}`, { methodId: rpcId, rawResponse: cleaned });
    }
    return result;

  } catch (e) {
    if (e instanceof RPCError) {
        if (!e.foundIds || e.foundIds.length === 0) e.foundIds = foundIds;
        if (!e.rawResponse) e.rawResponse = cleaned;
    }
    throw e;
  }
}
