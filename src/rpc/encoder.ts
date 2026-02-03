import { RPCMethod } from "./types";

/**
 * Encode an RPC request into batchexecute format.
 *
 * The batchexecute API expects a triple-nested array structure:
 * [[[rpc_id, json_params, null, "generic"]]]
 */
export function encodeRpcRequest(method: RPCMethod, params: any[]): any[][] {
  // JSON-encode params without spaces
  const paramsJson = JSON.stringify(params);

  // Build inner request: [rpc_id, json_params, null, "generic"]
  const inner = [method, paramsJson, null, "generic"];

  // Triple-nest the request
  return [[inner]];
}

/**
 * Build form-encoded request body for batchexecute.
 */
export function buildRequestBody(
  rpcRequest: any[][],
  csrfToken?: string,
  sessionId?: string
): string {
  // JSON-encode the request
  const fReq = JSON.stringify(rpcRequest);

  // We use encodeURIComponent to be safe.
  // Python uses quote(safe='') which encodes everything.
  // JS encodeURIComponent leaves - _ . ! ~ * ' ( )
  // This should be fine for Google's API usually.
  
  let body = `f.req=${encodeURIComponent(fReq)}`;

  if (csrfToken) {
    body += `&at=${encodeURIComponent(csrfToken)}`;
  }
  
  // Add trailing & as seen in Python implementation
  body += "&";

  return body;
}

/**
 * Build URL query parameters for batchexecute request.
 */
export function buildUrlParams(
  rpcMethod: RPCMethod,
  sourcePath = "/",
  sessionId?: string,
  bl?: string
): Record<string, string> {
  const params: Record<string, string> = {
    rpcids: rpcMethod,
    "source-path": sourcePath,
    hl: "en",
    rt: "c", // Chunked response mode
  };

  if (sessionId) {
    params["f.sid"] = sessionId;
  }

  if (bl) {
    params["bl"] = bl;
  }

  return params;
}
