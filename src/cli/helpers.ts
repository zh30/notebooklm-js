import fs from "fs";
import path from "path";
import { AuthTokens } from "../core/auth";
import { getContextPath } from "../core/paths";
import { NotebookLMClient } from "../client";

export function getAuthTokens(storagePath?: string): Promise<AuthTokens> {
    return AuthTokens.fromStorage(storagePath);
}

export function getCurrentNotebook(): string | null {
    const contextPath = getContextPath();
    if (!fs.existsSync(contextPath)) return null;
    try {
        const data = JSON.parse(fs.readFileSync(contextPath, "utf-8"));
        return data.notebook_id || null;
    } catch {
        return null;
    }
}

export function setCurrentNotebook(notebookId: string, title?: string, isOwner?: boolean, createdAt?: string) {
    const contextPath = getContextPath();
    const dir = path.dirname(contextPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    
    let currentContext: any = {};
    if (fs.existsSync(contextPath)) {
        try {
            currentContext = JSON.parse(fs.readFileSync(contextPath, "utf-8"));
        } catch {}
    }
    
    const data: any = { notebook_id: notebookId };
    if (title) data.title = title;
    if (isOwner !== undefined) data.is_owner = isOwner;
    if (createdAt) data.created_at = createdAt;
    
    if (currentContext.notebook_id === notebookId && currentContext.conversation_id) {
        data.conversation_id = currentContext.conversation_id;
    }
    
    fs.writeFileSync(contextPath, JSON.stringify(data, null, 2));
}

export function requireNotebook(notebookId?: string): string {
    if (notebookId) return notebookId.trim();
    const current = getCurrentNotebook();
    if (current) return current.trim();
    
    console.error("No notebook specified. Use 'notebooklm use <id>' to set context or provide --notebook <id>.");
    process.exit(1);
}

export async function createClient(storagePath?: string): Promise<NotebookLMClient> {
    try {
        return await NotebookLMClient.fromStorage(storagePath);
    } catch (e: any) {
        console.error(`Authentication failed: ${e.message}`);
        process.exit(1);
    }
}
