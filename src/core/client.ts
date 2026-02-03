import { AuthTokens } from "./auth";
import { RPCMethod, BATCHEXECUTE_URL } from "../rpc/types";
import { encodeRpcRequest, buildRequestBody, buildUrlParams } from "../rpc/encoder";
import { decodeResponse } from "../rpc/decoder";
import {
  RPCError,
  AuthError,
  RateLimitError,
  ServerError,
  ClientError,
  NetworkError,
  RPCTimeoutError,
} from "./exceptions";

const DEFAULT_TIMEOUT = 30000; // ms

export class ClientCore {
  auth: AuthTokens;
  private refreshCallback?: () => Promise<AuthTokens>;
  private conversationCache: Map<string, any[]> = new Map();
  private maxConversationCacheSize = 100;

  constructor(auth: AuthTokens, refreshCallback?: () => Promise<AuthTokens>) {
    this.auth = auth;
    this.refreshCallback = refreshCallback;
  }

  async rpcCall(
    method: RPCMethod,
    params: any[],
    sourcePath = "/",
    allowNull = false,
    isRetry = false
  ): Promise<any> {
    const urlParams = buildUrlParams(method, sourcePath, this.auth.sessionId);
    const queryString = new URLSearchParams(urlParams).toString();
    const url = `${BATCHEXECUTE_URL}?${queryString}`;

    const rpcRequest = encodeRpcRequest(method, params);
    const body = buildRequestBody(rpcRequest, this.auth.csrfToken);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

      let response: Response;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            "Cookie": this.auth.cookieHeader,
          },
          body: body,
          signal: controller.signal,
        });
      } catch (e: any) {
        if (e.name === "AbortError") {
          throw new RPCTimeoutError(`Request timed out calling ${method}`, {
            methodId: method,
            timeoutSeconds: DEFAULT_TIMEOUT / 1000,
            originalError: e,
          });
        }
        throw new NetworkError(`Request failed calling ${method}: ${e.message}`, {
            methodId: method,
            originalError: e
        });
      } finally {
        clearTimeout(timeoutId);
      }

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          if (!isRetry && this.refreshCallback) {
            return this.tryRefreshAndRetry(method, params, sourcePath, allowNull);
          }
          throw new AuthError(`HTTP ${response.status} calling ${method}`, {
            methodId: method,
            rpcCode: response.status,
          });
        }
        
        if (response.status === 429) {
            const retryAfter = response.headers.get("retry-after") ? parseInt(response.headers.get("retry-after")!) : undefined;
            throw new RateLimitError(`API rate limit exceeded calling ${method}`, {
                methodId: method,
                retryAfter,
                rpcCode: 429
            });
        }
        
        if (response.status >= 500) {
            throw new ServerError(`Server error ${response.status} calling ${method}`, {
                methodId: method,
                statusCode: response.status
            });
        }
        
        if (response.status >= 400) {
             throw new ClientError(`Client error ${response.status} calling ${method}`, {
                methodId: method,
                statusCode: response.status
            });
        }

        throw new RPCError(`HTTP ${response.status} calling ${method}`, { methodId: method });
      }

      const text = await response.text();
      return decodeResponse(text, method, allowNull);

    } catch (e: any) {
      if (e instanceof RPCError && !isRetry && this.refreshCallback && this.isAuthError(e)) {
        return this.tryRefreshAndRetry(method, params, sourcePath, allowNull);
      }
      throw e;
    }
  }

  private async tryRefreshAndRetry(
    method: RPCMethod,
    params: any[],
    sourcePath: string,
    allowNull: boolean
  ): Promise<any> {
    if (!this.refreshCallback) throw new Error("No refresh callback provided");

    try {
      this.auth = await this.refreshCallback();
      return this.rpcCall(method, params, sourcePath, allowNull, true);
    } catch (e) {
      throw e;
    }
  }

  private isAuthError(error: any): boolean {
    if (error instanceof AuthError) return true;
    if (error instanceof RPCError) {
      const msg = error.message.toLowerCase();
      return ["authentication", "expired", "unauthorized", "login", "re-authenticate"].some((p) =>
        msg.includes(p)
      );
    }
    return false;
  }

  cacheConversationTurn(conversationId: string, query: string, answer: string, turnNumber: number) {
      if (!this.conversationCache.has(conversationId)) {
          if (this.conversationCache.size >= this.maxConversationCacheSize) {
              const firstKey = this.conversationCache.keys().next().value;
              if (firstKey) this.conversationCache.delete(firstKey);
          }
          this.conversationCache.set(conversationId, []);
      }
      const cache = this.conversationCache.get(conversationId);
      if (cache) {
          cache.push({ query, answer, turn_number: turnNumber });
      }
  }
  
  getCachedConversation(conversationId: string): any[] {
      return this.conversationCache.get(conversationId) || [];
  }
  
  clearConversationCache(conversationId?: string) {
      if (conversationId) {
          this.conversationCache.delete(conversationId);
      } else {
          this.conversationCache.clear();
      }
  }
}
