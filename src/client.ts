import { AuthTokens } from "./core/auth";
import { ClientCore } from "./core/client";
import { NotebooksAPI } from "./notebooks";
import { SourcesAPI } from "./sources";
import { ChatAPI } from "./chat";
import { isGoogleAuthRedirect } from "./core/url_utils";

const DEFAULT_TIMEOUT = 30000;

export class NotebookLMClient {
  private core: ClientCore;
  
  notebooks: NotebooksAPI;
  sources: SourcesAPI;
  chat: ChatAPI;

  constructor(auth: AuthTokens, timeout = DEFAULT_TIMEOUT) {
    this.core = new ClientCore(auth, () => this.refreshAuth());
    this.notebooks = new NotebooksAPI(this.core);
    this.sources = new SourcesAPI(this.core);
    this.chat = new ChatAPI(this.core);
  }

  get auth(): AuthTokens {
    return this.core.auth;
  }

  static async fromStorage(pathStr?: string, timeout = DEFAULT_TIMEOUT): Promise<NotebookLMClient> {
    const auth = await AuthTokens.fromStorage(pathStr);
    return new NotebookLMClient(auth, timeout);
  }

  async refreshAuth(): Promise<AuthTokens> {
    const response = await fetch("https://notebooklm.google.com/", {
        headers: {
            "Cookie": this.core.auth.cookieHeader,
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        },
        redirect: "follow"
    });

    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }

    const finalUrl = response.url;
    if (isGoogleAuthRedirect(finalUrl)) {
        throw new Error("Authentication expired. Run 'notebooklm login' to re-authenticate.");
    }

    const html = await response.text();
    const csrfMatch = html.match(/"SNlM0e":"([^"]+)"/);
    if (!csrfMatch) {
        throw new Error("Failed to extract CSRF token (SNlM0e). Page structure may have changed or authentication expired.");
    }
    this.core.auth.csrfToken = csrfMatch[1] || "";

    const sidMatch = html.match(/"FdrFJe":"([^"]+)"/);
    if (!sidMatch) {
        throw new Error("Failed to extract session ID (FdrFJe). Page structure may have changed or authentication expired.");
    }
    this.core.auth.sessionId = sidMatch[1] || "";

    return this.core.auth;
  }
}
