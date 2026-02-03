import { ClientCore } from "./core/client";
import { RPCMethod, QUERY_URL } from "./rpc/types";
import { AskResult, ChatReference } from "./types";
import { ChatError } from "./core/exceptions";
import { v4 as uuidv4 } from "uuid";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MIN_ANSWER_LENGTH = 20;

export class ChatAPI {
  private core: ClientCore;
  private reqIdCounter = 100000;

  constructor(core: ClientCore) {
    this.core = core;
  }

  async ask(
    notebookId: string,
    question: string,
    sourceIds?: string[],
    conversationId?: string
  ): Promise<AskResult> {
    if (!sourceIds) {
        sourceIds = await this.getSourceIds(notebookId);
    }

    const isNewConversation = !conversationId;
    if (isNewConversation) {
        conversationId = uuidv4();
    }
    
    const conversationHistory = isNewConversation ? null : this.buildConversationHistory(conversationId!);
    
    const sourcesArray = sourceIds ? sourceIds.map(sid => [[sid]]) : [];
    
    const params = [
        sourcesArray,
        question,
        conversationHistory,
        [2, null, [1]],
        conversationId
    ];
    
    const paramsJson = JSON.stringify(params);
    const fReq = [null, paramsJson];
    const fReqJson = JSON.stringify(fReq);
    
    const bodyParts = [`f.req=${encodeURIComponent(fReqJson)}`];
    if (this.core.auth.csrfToken) {
        bodyParts.push(`at=${encodeURIComponent(this.core.auth.csrfToken)}`);
    }
    const body = bodyParts.join("&") + "&";
    
    this.reqIdCounter += 100000;
    const urlParams = new URLSearchParams({
        bl: process.env.NOTEBOOKLM_BL || "boq_labs-tailwind-frontend_20251221.14_p0",
        hl: "en",
        _reqid: String(this.reqIdCounter),
        rt: "c"
    });
    
    if (this.core.auth.sessionId) {
        urlParams.append("f.sid", this.core.auth.sessionId);
    }
    
    const url = `${QUERY_URL}?${urlParams.toString()}`;
    
    try {
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
                "Cookie": this.core.auth.cookieHeader,
            },
            body: body
        });
        
        if (!response.ok) throw new ChatError(`Chat request failed with HTTP ${response.status}`);
        
        const text = await response.text();
        const { answer, references } = this.parseAskResponse(text);
        
        const turns = this.core.getCachedConversation(conversationId!);
        const turnNumber = answer ? turns.length + 1 : turns.length;
        
        if (answer) {
            this.core.cacheConversationTurn(conversationId!, question, answer, turnNumber);
        }
        
        return new AskResult(
            answer,
            conversationId!,
            turnNumber,
            !isNewConversation,
            references,
            text.substring(0, 1000)
        );
        
    } catch (e: any) {
        throw new ChatError(`Chat request failed: ${e.message}`);
    }
  }
  
  private async getSourceIds(notebookId: string): Promise<string[]> {
      const params = [notebookId, null, [2], null, 0];
      const result = await this.core.rpcCall(RPCMethod.GET_NOTEBOOK, params, `/notebook/${notebookId}`);
      
      const sourceIds: string[] = [];
      if (result && Array.isArray(result) && result.length > 0) {
          const nbInfo = result[0];
          if (Array.isArray(nbInfo) && nbInfo.length > 1 && Array.isArray(nbInfo[1])) {
              const sources = nbInfo[1];
              for (const source of sources) {
                  if (Array.isArray(source) && source.length > 0) {
                      const first = source[0];
                      if (Array.isArray(first) && first.length > 0) {
                          const sid = first[0];
                          if (typeof sid === "string") sourceIds.push(sid);
                      }
                  }
              }
          }
      }
      return sourceIds;
  }
  
  private buildConversationHistory(conversationId: string): any[] | null {
      const turns = this.core.getCachedConversation(conversationId);
      if (!turns || turns.length === 0) return null;
      
      const history: any[] = [];
      for (const turn of turns) {
          history.push([turn.answer, null, 2]);
          history.push([turn.query, null, 1]);
      }
      return history;
  }
  
  private parseAskResponse(responseText: string): { answer: string, references: ChatReference[] } {
      if (responseText.startsWith(")]}'")) {
          responseText = responseText.substring(4);
      }
      
      const lines = responseText.trim().split("\n");
      let longestAnswer = "";
      const allReferences: ChatReference[] = [];
      
      let i = 0;
      while (i < lines.length) {
          const line = lines[i].trim();
          if (!line) { i++; continue; }
          
          if (!isNaN(Number(line))) {
              i++;
              if (i < lines.length) {
                  const { text, isAnswer, refs } = this.extractAnswerAndRefs(lines[i]!);
                  if (text && isAnswer && text.length > longestAnswer.length) {
                      longestAnswer = text;
                  }
                  allReferences.push(...refs);
              }
              i++;
          } else {
              const { text, isAnswer, refs } = this.extractAnswerAndRefs(line);
              if (text && isAnswer && text.length > longestAnswer.length) {
                  longestAnswer = text;
              }
              allReferences.push(...refs);
              i++;
          }
      }
      
      allReferences.forEach((ref: ChatReference, idx) => {
          if (ref && ref.citationNumber === undefined) ref.citationNumber = idx + 1;
      });
      
      return { answer: longestAnswer, references: allReferences };
  }
  
  private extractAnswerAndRefs(jsonStr: string): { text: string | null, isAnswer: boolean, refs: ChatReference[] } {
      const refs: ChatReference[] = [];
      try {
          const data = JSON.parse(jsonStr);
          if (!Array.isArray(data)) return { text: null, isAnswer: false, refs };
          
          for (const item of data) {
              if (!Array.isArray(item) || item.length < 3) continue;
              if (item[0] !== "wrb.fr") continue;
              
              const innerJson = item[2];
              if (typeof innerJson !== "string") continue;
              
              try {
                  const innerData = JSON.parse(innerJson);
                  if (Array.isArray(innerData) && innerData.length > 0) {
                      const first = innerData[0];
                      if (Array.isArray(first) && first.length > 0) {
                          const text = first[0];
                          let isAnswer = false;
                          
                          if (typeof text === "string" && text.length > MIN_ANSWER_LENGTH) {
                              if (first.length > 4 && Array.isArray(first[4])) {
                                  const typeInfo = first[4];
                                  if (typeInfo.length > 0 && typeInfo[typeInfo.length - 1] === 1) {
                                      isAnswer = true;
                                  }
                                  
                                  const parsedRefs = this.parseCitations(first);
                                  refs.push(...parsedRefs);
                                  
                                  return { text, isAnswer, refs };
                              }
                          }
                      }
                  }
              } catch {}
          }
      } catch {}
      return { text: null, isAnswer: false, refs };
  }
  
  private parseCitations(first: any[]): ChatReference[] {
      try {
          if (first.length <= 4 || !Array.isArray(first[4])) return [];
          const typeInfo = first[4];
          if (typeInfo.length <= 3 || !Array.isArray(typeInfo[3])) return [];
          
          const refs: ChatReference[] = [];
          for (const cite of typeInfo[3]) {
              const ref = this.parseSingleCitation(cite);
              if (ref) refs.push(ref);
          }
          return refs;
      } catch {
          return [];
      }
  }
  
  private parseSingleCitation(cite: any): ChatReference | null {
      if (!Array.isArray(cite) || cite.length < 2) return null;
      
      const citeInner = cite[1];
      if (!Array.isArray(citeInner)) return null;
      
      const sourceIdData = citeInner.length > 5 ? citeInner[5] : null;
      const sourceId = this.extractUuid(sourceIdData);
      if (!sourceId) return null;
      
      let chunkId: string | undefined;
      if (Array.isArray(cite[0]) && cite[0].length > 0) {
          const firstItem = cite[0][0];
          if (typeof firstItem === "string") chunkId = firstItem;
      }
      
      const { citedText, startChar, endChar } = this.extractTextPassages(citeInner);
      
      return new ChatReference(sourceId, undefined, citedText, startChar, endChar, chunkId);
  }
  
  private extractUuid(data: any, maxDepth = 10): string | null {
      if (maxDepth <= 0) return null;
      if (!data) return null;
      if (typeof data === "string") {
          return UUID_PATTERN.test(data) ? data : null;
      }
      if (Array.isArray(data)) {
          for (const item of data) {
              const result = this.extractUuid(item, maxDepth - 1);
              if (result) return result;
          }
      }
      return null;
  }
  
  private extractTextPassages(citeInner: any[]): { citedText?: string, startChar?: number, endChar?: number } {
      if (citeInner.length <= 4 || !Array.isArray(citeInner[4])) return {};
      
      const texts: string[] = [];
      let startChar: number | undefined;
      let endChar: number | undefined;
      
      for (const passageWrapper of citeInner[4]) {
          if (!Array.isArray(passageWrapper) || passageWrapper.length === 0) continue;
          const passageData = passageWrapper[0];
          if (!Array.isArray(passageData) || passageData.length < 3) continue;
          
          if (startChar === undefined && typeof passageData[0] === "number") startChar = passageData[0];
          if (typeof passageData[1] === "number") endChar = passageData[1];
          
          this.collectTexts(passageData[2], texts);
      }
      
      return {
          citedText: texts.length > 0 ? texts.join(" ") : undefined,
          startChar,
          endChar
      };
  }
  
  private collectTexts(nested: any, texts: string[]) {
      if (!Array.isArray(nested)) return;
      for (const group of nested) {
          if (!Array.isArray(group)) continue;
          for (const inner of group) {
              if (!Array.isArray(inner) || inner.length < 3) continue;
              const textVal = inner[2];
              if (typeof textVal === "string" && textVal.trim()) {
                  texts.push(textVal.trim());
              } else if (Array.isArray(textVal)) {
                  for (const item of textVal) {
                      if (typeof item === "string" && item.trim()) {
                          texts.push(item.trim());
                      }
                  }
              }
          }
      }
  }
}
