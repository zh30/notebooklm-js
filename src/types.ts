import {
  SourceStatus,
  ArtifactStatus,
  ArtifactTypeCode,
  SharePermission,
  ShareAccess,
  ShareViewLevel,
  RPCMethod
} from "./rpc/types";

export * from "./rpc/types";

export enum SourceType {
    GOOGLE_DOCS = "google_docs",
    GOOGLE_SLIDES = "google_slides",
    GOOGLE_SPREADSHEET = "google_spreadsheet",
    PDF = "pdf",
    PASTED_TEXT = "pasted_text",
    WEB_PAGE = "web_page",
    GOOGLE_DRIVE_AUDIO = "google_drive_audio",
    GOOGLE_DRIVE_VIDEO = "google_drive_video",
    YOUTUBE = "youtube",
    MARKDOWN = "markdown",
    DOCX = "docx",
    CSV = "csv",
    IMAGE = "image",
    MEDIA = "media",
    UNKNOWN = "unknown",
}

export enum ArtifactType {
    AUDIO = "audio",
    VIDEO = "video",
    REPORT = "report",
    QUIZ = "quiz",
    FLASHCARDS = "flashcards",
    MIND_MAP = "mind_map",
    INFOGRAPHIC = "infographic",
    SLIDE_DECK = "slide_deck",
    DATA_TABLE = "data_table",
    UNKNOWN = "unknown",
}

const SOURCE_TYPE_CODE_MAP: Record<number, SourceType> = {
    1: SourceType.GOOGLE_DOCS,
    2: SourceType.GOOGLE_SLIDES,
    3: SourceType.PDF,
    4: SourceType.PASTED_TEXT,
    5: SourceType.WEB_PAGE,
    8: SourceType.MARKDOWN,
    9: SourceType.YOUTUBE,
    10: SourceType.MEDIA,
    11: SourceType.DOCX,
    13: SourceType.IMAGE,
    14: SourceType.GOOGLE_SPREADSHEET,
    16: SourceType.CSV,
};

const ARTIFACT_TYPE_CODE_MAP: Record<number, ArtifactType> = {
    1: ArtifactType.AUDIO,
    2: ArtifactType.REPORT,
    3: ArtifactType.VIDEO,
    5: ArtifactType.MIND_MAP,
    7: ArtifactType.INFOGRAPHIC,
    8: ArtifactType.SLIDE_DECK,
    9: ArtifactType.DATA_TABLE,
};

export function getSafeSourceType(typeCode: number | null): SourceType {
    if (typeCode === null) return SourceType.UNKNOWN;
    return SOURCE_TYPE_CODE_MAP[typeCode] || SourceType.UNKNOWN;
}

export function mapArtifactKind(artifactType: number, variant: number | null): ArtifactType {
    if (artifactType === 4) { // QUIZ
        if (variant === 1) return ArtifactType.FLASHCARDS;
        if (variant === 2) return ArtifactType.QUIZ;
        return ArtifactType.UNKNOWN;
    }
    return ARTIFACT_TYPE_CODE_MAP[artifactType] || ArtifactType.UNKNOWN;
}

export class Notebook {
    id: string;
    title: string;
    createdAt?: Date;
    sourcesCount: number;
    isOwner: boolean;

    constructor(id: string, title: string, createdAt?: Date, sourcesCount = 0, isOwner = true) {
        this.id = id;
        this.title = title;
        this.createdAt = createdAt;
        this.sourcesCount = sourcesCount;
        this.isOwner = isOwner;
    }

    static fromApiResponse(data: any[]): Notebook {
        const rawTitle = (data.length > 0 && typeof data[0] === "string") ? data[0] : "";
        const title = rawTitle.replace("thought\n", "").trim();
        const notebookId = (data.length > 2 && typeof data[2] === "string") ? data[2] : "";

        let createdAt: Date | undefined;
        if (data.length > 5 && Array.isArray(data[5]) && data[5].length > 5) {
            const tsData = data[5][5];
            if (Array.isArray(tsData) && tsData.length > 0 && typeof tsData[0] === "number") {
                createdAt = new Date(tsData[0] * 1000); // Python uses seconds, JS uses ms? No, Python fromtimestamp expects seconds. JS Date expects ms.
                // Wait, Python timestamp is usually seconds. JS Date(number) is milliseconds.
                // Assuming data[0] is seconds (Unix timestamp).
                // Let's check Python code: datetime.fromtimestamp(ts_data[0]) -> expects seconds (float).
                // So in JS: new Date(tsData[0] * 1000).
            }
        }

        let isOwner = true;
        if (data.length > 5 && Array.isArray(data[5]) && data[5].length > 1) {
            isOwner = data[5][1] === false; // False means owner, True means shared
        }

        return new Notebook(notebookId, title, createdAt, 0, isOwner);
    }
}

export class SuggestedTopic {
    question: string;
    prompt: string;

    constructor(question: string, prompt: string) {
        this.question = question;
        this.prompt = prompt;
    }
}

export class NotebookDescription {
    summary: string;
    suggestedTopics: SuggestedTopic[];

    constructor(summary: string, suggestedTopics: SuggestedTopic[] = []) {
        this.summary = summary;
        this.suggestedTopics = suggestedTopics;
    }

    static fromApiResponse(data: any): NotebookDescription {
        const topics = (data.suggested_topics || []).map((t: any) =>
            new SuggestedTopic(t.question || "", t.prompt || "")
        );
        return new NotebookDescription(data.summary || "", topics);
    }
}

export class Source {
    id: string;
    title?: string;
    url?: string;
    _typeCode?: number;
    createdAt?: Date;
    status: number;

    constructor(id: string, title?: string, url?: string, typeCode?: number, createdAt?: Date, status = SourceStatus.READY) {
        this.id = id;
        this.title = title;
        this.url = url;
        this._typeCode = typeCode;
        this.createdAt = createdAt;
        this.status = status;
    }

    get kind(): SourceType {
        return getSafeSourceType(this._typeCode || null);
    }

    get isReady(): boolean { return this.status === SourceStatus.READY; }
    get isProcessing(): boolean { return this.status === SourceStatus.PROCESSING; }
    get isError(): boolean { return this.status === SourceStatus.ERROR; }

    static fromApiResponse(data: any[], notebookId?: string): Source {
        if (!data || !Array.isArray(data)) throw new Error(`Invalid source data: ${data}`);

        // Try deeply nested format
        if (Array.isArray(data[0]) && data[0].length > 0) {
            if (Array.isArray(data[0][0]) && data[0][0].length > 0) {
                if (Array.isArray(data[0][0][0])) {
                    // Deeply nested
                    const entry = data[0][0];
                    const sourceId = Array.isArray(entry[0]) ? entry[0][0] : entry[0];
                    const title = entry.length > 1 ? entry[1] : undefined;
                    
                    let url: string | undefined;
                    let typeCode: number | undefined;
                    
                    if (entry.length > 2 && Array.isArray(entry[2])) {
                        if (entry[2].length > 7) {
                            const urlList = entry[2][7];
                            if (Array.isArray(urlList) && urlList.length > 0) {
                                url = urlList[0];
                            }
                        }
                        if (!url && entry[2].length > 0 && typeof entry[2][0] === "string" && entry[2][0].startsWith("http")) {
                            url = entry[2][0];
                        }
                        if (entry[2].length > 4 && typeof entry[2][4] === "number") {
                            typeCode = entry[2][4];
                        }
                    }
                    return new Source(String(sourceId), title, url, typeCode);
                } else {
                     // Medium nested
                     const entry = data[0];
                     const sourceId = Array.isArray(entry[0]) ? entry[0][0] : entry[0];
                     const title = entry.length > 1 ? entry[1] : undefined;
                     
                     let url: string | undefined;
                     if (entry.length > 2 && Array.isArray(entry[2])) {
                         if (entry[2].length > 7 && Array.isArray(entry[2][7])) {
                             url = entry[2][7][0];
                         }
                     }
                     return new Source(String(sourceId), title, url);
                }
            }
        }

        const sourceId = data.length > 0 ? data[0] : "";
        const title = data.length > 1 ? data[1] : undefined;
        return new Source(String(sourceId), title);
    }
}

export class Artifact {
    id: string;
    title: string;
    _artifactType: number;
    status: number;
    createdAt?: Date;
    url?: string;
    _variant?: number;

    constructor(id: string, title: string, artifactType: number, status: number, createdAt?: Date, url?: string, variant?: number) {
        this.id = id;
        this.title = title;
        this._artifactType = artifactType;
        this.status = status;
        this.createdAt = createdAt;
        this.url = url;
        this._variant = variant;
    }

    get kind(): ArtifactType {
        return mapArtifactKind(this._artifactType, this._variant || null);
    }

    get isCompleted(): boolean { return this.status === ArtifactStatus.COMPLETED; }
    get isProcessing(): boolean { return this.status === ArtifactStatus.PROCESSING; }
    get isPending(): boolean { return this.status === ArtifactStatus.PENDING; }
    get isFailed(): boolean { return this.status === ArtifactStatus.FAILED; }
    
    get isQuiz(): boolean { return this._artifactType === 4 && this._variant === 2; }
    get isFlashcards(): boolean { return this._artifactType === 4 && this._variant === 1; }

    static fromApiResponse(data: any[]): Artifact {
        const artifactId = data.length > 0 ? data[0] : "";
        const title = data.length > 1 ? data[1] : "";
        const artifactType = data.length > 2 ? data[2] : 0;
        const status = data.length > 4 ? data[4] : 0;

        let createdAt: Date | undefined;
        if (data.length > 15 && Array.isArray(data[15]) && data[15].length > 0) {
            try {
                createdAt = new Date(data[15][0] * 1000);
            } catch {}
        }

        let variant: number | undefined;
        if (data.length > 9 && Array.isArray(data[9]) && data[9].length > 1) {
            const options = data[9][1];
            if (Array.isArray(options) && options.length > 0) {
                variant = options[0];
            }
        }

        return new Artifact(String(artifactId), String(title), artifactType, status, createdAt, undefined, variant);
    }
}

export class Note {
    id: string;
    notebookId: string;
    title: string;
    content: string;
    createdAt?: Date;

    constructor(id: string, notebookId: string, title: string, content: string, createdAt?: Date) {
        this.id = id;
        this.notebookId = notebookId;
        this.title = title;
        this.content = content;
        this.createdAt = createdAt;
    }

    static fromApiResponse(data: any[], notebookId: string): Note {
        const noteId = data.length > 0 ? data[0] : "";
        const title = data.length > 1 ? data[1] : "";
        const content = data.length > 2 ? data[2] : "";
        
        let createdAt: Date | undefined;
        if (data.length > 3 && Array.isArray(data[3]) && data[3].length > 0) {
            try {
                createdAt = new Date(data[3][0] * 1000);
            } catch {}
        }
        
        return new Note(String(noteId), notebookId, String(title), String(content), createdAt);
    }
}

export class SharedUser {
    email: string;
    permission: SharePermission;
    displayName?: string;
    avatarUrl?: string;
    
    constructor(email: string, permission: SharePermission, displayName?: string, avatarUrl?: string) {
        this.email = email;
        this.permission = permission;
        this.displayName = displayName;
        this.avatarUrl = avatarUrl;
    }
    
    static fromApiResponse(data: any[]): SharedUser {
        const email = data.length > 0 ? data[0] : "";
        const permValue = data.length > 1 ? data[1] : 3;
        const permission = (Object.values(SharePermission).includes(permValue)) ? permValue : SharePermission.VIEWER;
        
        let displayName: string | undefined;
        let avatarUrl: string | undefined;
        
        if (data.length > 3 && Array.isArray(data[3])) {
            const userInfo = data[3];
            displayName = userInfo.length > 0 ? userInfo[0] : undefined;
            avatarUrl = userInfo.length > 1 ? userInfo[1] : undefined;
        }
        
        return new SharedUser(email, permission, displayName, avatarUrl);
    }
}

export class ShareStatus {
    notebookId: string;
    isPublic: boolean;
    access: ShareAccess;
    viewLevel: ShareViewLevel;
    sharedUsers: SharedUser[];
    shareUrl?: string;
    
    constructor(notebookId: string, isPublic: boolean, access: ShareAccess, viewLevel: ShareViewLevel, sharedUsers: SharedUser[] = [], shareUrl?: string) {
        this.notebookId = notebookId;
        this.isPublic = isPublic;
        this.access = access;
        this.viewLevel = viewLevel;
        this.sharedUsers = sharedUsers;
        this.shareUrl = shareUrl;
    }
    
    static fromApiResponse(data: any[], notebookId: string): ShareStatus {
        const users: SharedUser[] = [];
        if (data && Array.isArray(data[0])) {
            for (const userData of data[0]) {
                if (Array.isArray(userData)) {
                    users.push(SharedUser.fromApiResponse(userData));
                }
            }
        }
        
        let isPublic = false;
        if (data.length > 1 && Array.isArray(data[1]) && data[1].length > 0) {
            isPublic = Boolean(data[1][0]);
        }
        
        const access = isPublic ? ShareAccess.ANYONE_WITH_LINK : ShareAccess.RESTRICTED;
        const viewLevel = ShareViewLevel.FULL_NOTEBOOK;
        const shareUrl = isPublic ? `https://notebooklm.google.com/notebook/${notebookId}` : undefined;
        
        return new ShareStatus(notebookId, isPublic, access, viewLevel, users, shareUrl);
    }
}

export class ChatReference {
    sourceId: string;
    citationNumber?: number;
    citedText?: string;
    startChar?: number;
    endChar?: number;
    chunkId?: string;
    
    constructor(sourceId: string, citationNumber?: number, citedText?: string, startChar?: number, endChar?: number, chunkId?: string) {
        this.sourceId = sourceId;
        this.citationNumber = citationNumber;
        this.citedText = citedText;
        this.startChar = startChar;
        this.endChar = endChar;
        this.chunkId = chunkId;
    }
}

export class AskResult {
    answer: string;
    conversationId: string;
    turnNumber: number;
    isFollowUp: boolean;
    references: ChatReference[];
    rawResponse: string;
    
    constructor(answer: string, conversationId: string, turnNumber: number, isFollowUp: boolean, references: ChatReference[] = [], rawResponse = "") {
        this.answer = answer;
        this.conversationId = conversationId;
        this.turnNumber = turnNumber;
        this.isFollowUp = isFollowUp;
        this.references = references;
        this.rawResponse = rawResponse;
    }
}
