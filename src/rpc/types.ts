/**
 * RPC types and constants for NotebookLM API.
 */

// NotebookLM API endpoints
export const BATCHEXECUTE_URL = "https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute";
export const QUERY_URL = "https://notebooklm.google.com/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed";
export const UPLOAD_URL = "https://notebooklm.google.com/upload/_/";

/**
 * RPC method IDs for NotebookLM operations.
 *
 * These are obfuscated method identifiers used by the batchexecute API.
 * Reverse-engineered from network traffic analysis.
 */
export enum RPCMethod {
    // Notebook operations
    LIST_NOTEBOOKS = "wXbhsf",
    CREATE_NOTEBOOK = "CCqFvf",
    GET_NOTEBOOK = "rLM1Ne",
    RENAME_NOTEBOOK = "s0tc2d",
    DELETE_NOTEBOOK = "WWINqb",

    // Source operations
    ADD_SOURCE = "izAoDd",
    ADD_SOURCE_FILE = "o4cbdc",  // Register uploaded file as source
    DELETE_SOURCE = "tGMBJ",
    GET_SOURCE = "hizoJc",
    REFRESH_SOURCE = "FLmJqe",
    CHECK_SOURCE_FRESHNESS = "yR9Yof",
    UPDATE_SOURCE = "b7Wfje",
    DISCOVER_SOURCES = "qXyaNe",

    // Summary and query
    SUMMARIZE = "VfAZjd",
    GET_SOURCE_GUIDE = "tr032e",
    GET_SUGGESTED_REPORTS = "ciyUvf",  // AI-suggested report formats

    // Query endpoint (not a batchexecute RPC ID)
    QUERY_ENDPOINT = "/_/LabsTailwindUi/data/google.internal.labs.tailwind.orchestration.v1.LabsTailwindOrchestrationService/GenerateFreeFormStreamed",

    // Artifact operations
    CREATE_ARTIFACT = "R7cb6c",  // Generate any artifact (audio, video, report, quiz, etc.)
    LIST_ARTIFACTS = "gArtLc",  // List all artifacts in a notebook
    DELETE_ARTIFACT = "V5N4be",
    RENAME_ARTIFACT = "rc3d8d",
    EXPORT_ARTIFACT = "Krh3pd",
    SHARE_ARTIFACT = "RGP97b",
    GET_INTERACTIVE_HTML = "v9rmvd",  // Fetch quiz/flashcard HTML content

    // Research
    START_FAST_RESEARCH = "Ljjv0c",
    START_DEEP_RESEARCH = "QA9ei",
    POLL_RESEARCH = "e3bVqc",
    IMPORT_RESEARCH = "LBwxtb",

    // Note and mind map operations
    GENERATE_MIND_MAP = "yyryJe",  // Generate mind map from sources
    CREATE_NOTE = "CYK0Xb",
    GET_NOTES_AND_MIND_MAPS = "cFji9",  // Returns both notes and mind maps
    UPDATE_NOTE = "cYAfTb",
    DELETE_NOTE = "AH0mwd",

    // Conversation
    GET_CONVERSATION_HISTORY = "hPTbtc",

    // Sharing operations (notebook-level)
    SHARE_NOTEBOOK = "QDyure",  // Set notebook visibility (restricted/anyone with link)
    GET_SHARE_STATUS = "JFMDGd",  // Get notebook share settings

    // Additional notebook operations
    REMOVE_RECENTLY_VIEWED = "fejl7e",

    // User settings
    GET_USER_SETTINGS = "ZwVcOc",  // Get user settings including output language
    SET_USER_SETTINGS = "hT54vc",  // Set user settings (e.g., output language)
}

/**
 * Integer codes for artifact types used in RPC calls.
 *
 * These are the raw codes used in the CREATE_ARTIFACT (R7cb6c) RPC call.
 * Values correspond to artifact_data[2] in API responses.
 */
export enum ArtifactTypeCode {
    AUDIO = 1,
    REPORT = 2,  // Includes: Briefing Doc, Study Guide, Blog Post, White Paper, Research Proposal, etc.
    VIDEO = 3,
    QUIZ = 4,  // Also used for flashcards
    QUIZ_FLASHCARD = 4,  // Alias for backward compatibility
    MIND_MAP = 5,
    INFOGRAPHIC = 7,
    SLIDE_DECK = 8,
    DATA_TABLE = 9,
}

// Deprecated alias for backward compatibility
export const StudioContentType = ArtifactTypeCode;

/**
 * Processing status of an artifact.
 *
 * Values correspond to artifact_data[4] in API responses.
 */
export enum ArtifactStatus {
    PROCESSING = 1,  // Artifact is being generated
    PENDING = 2,  // Artifact is queued
    COMPLETED = 3,  // Artifact is ready for use/download
    FAILED = 4,  // Generation failed
}

const _ARTIFACT_STATUS_MAP: Record<number, string> = {
    [ArtifactStatus.PROCESSING]: "in_progress",
    [ArtifactStatus.PENDING]: "pending",
    [ArtifactStatus.COMPLETED]: "completed",
    [ArtifactStatus.FAILED]: "failed",
};

/**
 * Convert artifact status code to human-readable string.
 */
export function artifactStatusToStr(statusCode: number): string {
    return _ARTIFACT_STATUS_MAP[statusCode] || "unknown";
}

/**
 * Audio overview format options.
 */
export enum AudioFormat {
    DEEP_DIVE = 1,
    BRIEF = 2,
    CRITIQUE = 3,
    DEBATE = 4,
}

/**
 * Audio overview length options.
 */
export enum AudioLength {
    SHORT = 1,
    DEFAULT = 2,
    LONG = 3,
}

/**
 * Video overview format options.
 */
export enum VideoFormat {
    EXPLAINER = 1,
    BRIEF = 2,
}

/**
 * Video visual style options.
 */
export enum VideoStyle {
    AUTO_SELECT = 1,
    CUSTOM = 2,
    CLASSIC = 3,
    WHITEBOARD = 4,
    KAWAII = 5,
    ANIME = 6,
    WATERCOLOR = 7,
    RETRO_PRINT = 8,
    HERITAGE = 9,
    PAPER_CRAFT = 10,
}

/**
 * Quiz/Flashcards quantity options.
 */
export enum QuizQuantity {
    FEWER = 1,
    STANDARD = 2,
    MORE = 2,  // Alias for STANDARD - API limitation
}

/**
 * Quiz/Flashcards difficulty options.
 */
export enum QuizDifficulty {
    EASY = 1,
    MEDIUM = 2,
    HARD = 3,
}

/**
 * Infographic orientation options.
 */
export enum InfographicOrientation {
    LANDSCAPE = 1,
    PORTRAIT = 2,
    SQUARE = 3,
}

/**
 * Infographic detail level options.
 */
export enum InfographicDetail {
    CONCISE = 1,
    STANDARD = 2,
    DETAILED = 3,
}

/**
 * Slide deck format options.
 */
export enum SlideDeckFormat {
    DETAILED_DECK = 1,
    PRESENTER_SLIDES = 2,
}

/**
 * Slide deck length options.
 */
export enum SlideDeckLength {
    DEFAULT = 1,
    SHORT = 2,
}

/**
 * Report format options for type 2 artifacts.
 */
export enum ReportFormat {
    BRIEFING_DOC = "briefing_doc",
    STUDY_GUIDE = "study_guide",
    BLOG_POST = "blog_post",
    CUSTOM = "custom",
}

/**
 * Chat persona/goal options for notebook configuration.
 */
export enum ChatGoal {
    DEFAULT = 1,  // General purpose research and brainstorming
    CUSTOM = 2,  // Custom prompt (up to 10,000 characters)
    LEARNING_GUIDE = 3,  // Educational focus with learning-oriented responses
}

/**
 * Chat response length options for notebook configuration.
 */
export enum ChatResponseLength {
    DEFAULT = 1,  // Standard response length
    LONGER = 4,  // Verbose, detailed responses
    SHORTER = 5,  // Concise, brief responses
}

/**
 * Google Drive MIME types for source integration.
 */
export enum DriveMimeType {
    GOOGLE_DOC = "application/vnd.google-apps.document",
    GOOGLE_SLIDES = "application/vnd.google-apps.presentation",
    GOOGLE_SHEETS = "application/vnd.google-apps.spreadsheet",
    PDF = "application/pdf",
}

/**
 * Export destination types for artifacts.
 */
export enum ExportType {
    DOCS = 1,  // Export to Google Docs
    SHEETS = 2,  // Export to Google Sheets
}

/**
 * Notebook access level for public sharing.
 */
export enum ShareAccess {
    RESTRICTED = 0,  // Only explicitly shared users
    ANYONE_WITH_LINK = 1,  // Public link access
}

/**
 * What viewers can access when shared.
 */
export enum ShareViewLevel {
    FULL_NOTEBOOK = 0,  // Chat + sources + notes
    CHAT_ONLY = 1,  // Chat interface only
}

/**
 * User permission level for sharing.
 */
export enum SharePermission {
    OWNER = 1,  // Full control (read-only, cannot assign)
    EDITOR = 2,  // Can edit notebook
    VIEWER = 3,  // Read-only access
    _REMOVE = 4,  // Internal: remove user from share list
}

/**
 * Processing status of a source.
 */
export enum SourceStatus {
    PROCESSING = 1,  // Source is being processed (indexing content)
    READY = 2,  // Source is ready for use
    ERROR = 3,  // Source processing failed
    PREPARING = 5,  // Source is being prepared/uploaded (pre-processing stage)
}

const _SOURCE_STATUS_MAP: Record<number, string> = {
    [SourceStatus.PROCESSING]: "processing",
    [SourceStatus.READY]: "ready",
    [SourceStatus.ERROR]: "error",
    [SourceStatus.PREPARING]: "preparing",
};

/**
 * Convert source status code to human-readable string.
 */
export function sourceStatusToStr(statusCode: number): string {
    return _SOURCE_STATUS_MAP[statusCode] || "unknown";
}
