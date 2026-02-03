import { test, expect } from "bun:test";
import { encodeRpcRequest, buildRequestBody } from "../src/rpc/encoder";
import { decodeResponse, stripAntiXssi, parseChunkedResponse, RPCErrorCode } from "../src/rpc/decoder";
import { RPCMethod } from "../src/rpc/types";

test("encodeRpcRequest creates correct structure", () => {
  const method = RPCMethod.LIST_NOTEBOOKS;
  const params = [1, "test"];
  const encoded = encodeRpcRequest(method, params);
  
  expect(encoded).toEqual([[[method, JSON.stringify(params), null, "generic"]]]);
});

test("buildRequestBody formats correctly", () => {
  const request = [[["method", "params", null, "generic"]]];
  const body = buildRequestBody(request, "token");
  
  expect(body).toContain("f.req=");
  expect(body).toContain("at=token");
});

test("stripAntiXssi removes prefix", () => {
  const response = ")]}'\n[1,2,3]";
  expect(stripAntiXssi(response)).toBe("[1,2,3]");
});

test("parseChunkedResponse handles chunks", () => {
  // Format: length\njson\nlength\njson
  const response = "2\n[]\n4\n[10]";
  const chunks = parseChunkedResponse(response);
  expect(chunks).toEqual([[], [10]]);
});

test("decodeResponse extracts result", () => {
  const rpcId = "testId";
  // Mock response: )]}' \n length \n [["wrb.fr", "testId", "result"]]
  const inner = JSON.stringify([["wrb.fr", rpcId, "success"]]);
  const response = `)]}'\n${inner.length}\n${inner}`;
  
  const result = decodeResponse(response, rpcId);
  expect(result).toBe("success");
});
