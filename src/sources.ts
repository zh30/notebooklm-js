import { ClientCore } from "./core/client";
import { RPCMethod, UPLOAD_URL } from "./rpc/types";
import { Source } from "./types";
import { SourceAddError, SourceNotFoundError, SourceProcessingError, SourceTimeoutError } from "./core/exceptions";
import { isYoutubeUrl } from "./core/url_utils";
import fs from "fs";
import path from "path";

export class SourcesAPI {
  private core: ClientCore;

  constructor(core: ClientCore) {
    this.core = core;
  }

  async list(notebookId: string): Promise<Source[]> {
    const params = [notebookId, null, [2], null, 0];
    const notebook = await this.core.rpcCall(
      RPCMethod.GET_NOTEBOOK,
      params,
      `/notebook/${notebookId}`
    );

    if (!notebook || !Array.isArray(notebook) || notebook.length === 0) return [];
    
    const nbInfo = notebook[0];
    if (!Array.isArray(nbInfo) || nbInfo.length <= 1) return [];
    
    const sourcesList = nbInfo[1];
    if (!Array.isArray(sourcesList)) return [];
    
    return sourcesList.map((src: any) => Source.fromApiResponse([src]));
  }

  async get(notebookId: string, sourceId: string): Promise<Source | null> {
    const sources = await this.list(notebookId);
    return sources.find(s => s.id === sourceId) || null;
  }

  async addUrl(notebookId: string, url: string, wait = false): Promise<Source> {
      const isYoutube = isYoutubeUrl(url);
      let result: any;
      
      if (isYoutube) {
          const params = [
            [[null, null, null, null, null, null, null, [url], null, null, 1]],
            notebookId,
            [2],
            [1, null, null, null, null, null, null, null, null, null, [1]],
          ];
          result = await this.core.rpcCall(RPCMethod.ADD_SOURCE, params, `/notebook/${notebookId}`);
      } else {
          const params = [
            [[null, null, [url], null, null, null, null, null]],
            notebookId,
            [2],
            null,
            null,
          ];
          result = await this.core.rpcCall(RPCMethod.ADD_SOURCE, params, `/notebook/${notebookId}`);
      }
      
      const source = Source.fromApiResponse(result);
      if (wait) {
          return this.waitUntilReady(notebookId, source.id);
      }
      return source;
  }
  
  async addText(notebookId: string, title: string, content: string, wait = false): Promise<Source> {
      const params = [
        [[null, [title, content], null, null, null, null, null, null]],
        notebookId,
        [2],
        null,
        null,
      ];
      const result = await this.core.rpcCall(RPCMethod.ADD_SOURCE, params, `/notebook/${notebookId}`);
      const source = Source.fromApiResponse(result);
      if (wait) {
          return this.waitUntilReady(notebookId, source.id);
      }
      return source;
  }
  
  async addFile(notebookId: string, filePath: string, wait = false): Promise<Source> {
      const resolvedPath = path.resolve(filePath);
      if (!fs.existsSync(resolvedPath)) throw new Error(`File not found: ${resolvedPath}`);
      
      const filename = path.basename(resolvedPath);
      const stats = fs.statSync(resolvedPath);
      const fileSize = stats.size;
      
      const params = [
        [[filename]],
        notebookId,
        [2],
        [1, null, null, null, null, null, null, null, null, null, [1]],
      ];
      const regResult = await this.core.rpcCall(RPCMethod.ADD_SOURCE_FILE, params, `/notebook/${notebookId}`);
      
      let sourceId = "";
      const extractId = (data: any): string | null => {
          if (typeof data === "string") return data;
          if (Array.isArray(data) && data.length > 0) return extractId(data[0]);
          return null;
      };
      sourceId = extractId(regResult) || "";
      if (!sourceId) throw new SourceAddError(filename, undefined, "Failed to get SOURCE_ID");
      
      const uploadUrl = await this.startResumableUpload(notebookId, filename, fileSize, sourceId);
      
      await this.uploadFile(uploadUrl, resolvedPath);
      
      const source = new Source(sourceId, filename);
      if (wait) {
          return this.waitUntilReady(notebookId, source.id);
      }
      return source;
  }
  
  private async startResumableUpload(notebookId: string, filename: string, fileSize: number, sourceId: string): Promise<string> {
      const url = `${UPLOAD_URL}?authuser=0`;
      const headers = {
          "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
          "Cookie": this.core.auth.cookieHeader,
          "x-goog-authuser": "0",
          "x-goog-upload-command": "start",
          "x-goog-upload-header-content-length": String(fileSize),
          "x-goog-upload-protocol": "resumable",
      };
      const body = JSON.stringify({
          "PROJECT_ID": notebookId,
          "SOURCE_NAME": filename,
          "SOURCE_ID": sourceId
      });
      
      const response = await fetch(url, { method: "POST", headers, body });
      if (!response.ok) throw new Error(`Failed to start upload: ${response.status}`);
      
      const uploadUrl = response.headers.get("x-goog-upload-url");
      if (!uploadUrl) throw new Error("No upload URL returned");
      
      return uploadUrl;
  }
  
  private async uploadFile(uploadUrl: string, filePath: string): Promise<void> {
      const file = Bun.file(filePath);
      const headers = {
          "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
          "Cookie": this.core.auth.cookieHeader,
          "x-goog-authuser": "0",
          "x-goog-upload-command": "upload, finalize",
          "x-goog-upload-offset": "0",
      };
      
      const response = await fetch(uploadUrl, { method: "POST", headers, body: file });
      if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
  }

  async waitUntilReady(notebookId: string, sourceId: string, timeout = 120000): Promise<Source> {
      const start = Date.now();
      while (Date.now() - start < timeout) {
          const source = await this.get(notebookId, sourceId);
          if (!source) throw new SourceNotFoundError(sourceId);
          
          if (source.isReady) return source;
          if (source.isError) throw new SourceProcessingError(sourceId, source.status);
          
          await new Promise(r => setTimeout(r, 1000));
      }
      throw new SourceTimeoutError(sourceId, timeout / 1000);
  }
  
  async delete(notebookId: string, sourceId: string): Promise<boolean> {
      const params = [[[sourceId]]];
      await this.core.rpcCall(RPCMethod.DELETE_SOURCE, params, `/notebook/${notebookId}`);
      return true;
  }
}
