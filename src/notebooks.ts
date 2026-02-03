import { ClientCore } from "./core/client";
import { RPCMethod } from "./rpc/types";
import { Notebook, NotebookDescription, SuggestedTopic } from "./types";

export class NotebooksAPI {
  private core: ClientCore;

  constructor(core: ClientCore) {
    this.core = core;
  }

  async list(): Promise<Notebook[]> {
    const params = [null, 1, null, [2]];
    const result = await this.core.rpcCall(RPCMethod.LIST_NOTEBOOKS, params);

    if (result && Array.isArray(result) && result.length > 0) {
      const rawNotebooks = Array.isArray(result[0]) ? result[0] : result;
      return rawNotebooks.map((nb: any) => Notebook.fromApiResponse(nb));
    }
    return [];
  }

  async create(title: string): Promise<Notebook> {
    const params = [title, null, null, [2], [1]];
    const result = await this.core.rpcCall(RPCMethod.CREATE_NOTEBOOK, params);
    return Notebook.fromApiResponse(result);
  }

  async get(notebookId: string): Promise<Notebook> {
    const params = [notebookId, null, [2], null, 0];
    const result = await this.core.rpcCall(
      RPCMethod.GET_NOTEBOOK,
      params,
      `/notebook/${notebookId}`
    );
    const nbInfo = (result && Array.isArray(result) && result.length > 0) ? result[0] : [];
    return Notebook.fromApiResponse(nbInfo);
  }

  async delete(notebookId: string): Promise<boolean> {
    const params = [[notebookId], [2]];
    await this.core.rpcCall(RPCMethod.DELETE_NOTEBOOK, params);
    return true;
  }

  async rename(notebookId: string, newTitle: string): Promise<Notebook> {
    const params = [notebookId, [[null, null, null, [null, newTitle]]]];
    await this.core.rpcCall(
      RPCMethod.RENAME_NOTEBOOK,
      params,
      "/",
      true
    );
    return this.get(notebookId);
  }

  async getSummary(notebookId: string): Promise<string> {
    const params = [notebookId, [2]];
    const result = await this.core.rpcCall(
      RPCMethod.SUMMARIZE,
      params,
      `/notebook/${notebookId}`
    );
    if (result && Array.isArray(result) && result.length > 0) {
      return result[0] ? String(result[0]) : "";
    }
    return "";
  }

  async getDescription(notebookId: string): Promise<NotebookDescription> {
    const params = [notebookId, [2]];
    const result = await this.core.rpcCall(
        RPCMethod.SUMMARIZE,
        params,
        `/notebook/${notebookId}`
    );
    
    let summary = "";
    const suggestedTopics: SuggestedTopic[] = [];
    
    if (result && Array.isArray(result)) {
        if (result.length > 0 && Array.isArray(result[0]) && result[0].length > 0) {
            if (typeof result[0][0] === "string") {
                summary = result[0][0];
            }
        }
        
        if (result.length > 1 && Array.isArray(result[1]) && result[1].length > 0) {
            const topicsList = Array.isArray(result[1][0]) ? result[1][0] : [];
            for (const topic of topicsList) {
                if (Array.isArray(topic) && topic.length >= 2) {
                    suggestedTopics.push(new SuggestedTopic(
                        typeof topic[0] === "string" ? topic[0] : "",
                        typeof topic[1] === "string" ? topic[1] : ""
                    ));
                }
            }
        }
    }
    
    return new NotebookDescription(summary, suggestedTopics);
  }
  
  async removeFromRecent(notebookId: string): Promise<void> {
      const params = [notebookId];
      await this.core.rpcCall(
          RPCMethod.REMOVE_RECENTLY_VIEWED,
          params,
          "/",
          true
      );
  }
}
