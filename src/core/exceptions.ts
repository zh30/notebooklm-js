/**
 * Exceptions for notebooklm-js.
 *
 * All library exceptions inherit from NotebookLMError.
 */

export class NotebookLMError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// =============================================================================
// Validation/Configuration
// =============================================================================

export class ValidationError extends NotebookLMError {}

export class ConfigurationError extends NotebookLMError {}

// =============================================================================
// Network (NOT under RPC - happens before RPC processing)
// =============================================================================

export class NetworkError extends NotebookLMError {
  methodId?: string;
  originalError?: Error;

  constructor(message: string, options?: { methodId?: string; originalError?: Error }) {
    super(message);
    this.methodId = options?.methodId;
    this.originalError = options?.originalError;
  }
}

// =============================================================================
// RPC Protocol
// =============================================================================

export class RPCError extends NotebookLMError {
  methodId?: string;
  rawResponse?: string;
  rpcCode?: string | number;
  foundIds: string[];

  constructor(
    message: string,
    options?: {
      methodId?: string;
      rawResponse?: string;
      rpcCode?: string | number;
      foundIds?: string[];
    }
  ) {
    super(message);
    this.methodId = options?.methodId;
    this.rawResponse = options?.rawResponse ? options.rawResponse.substring(0, 500) : undefined;
    this.rpcCode = options?.rpcCode;
    this.foundIds = options?.foundIds || [];
  }
}

export class DecodingError extends RPCError {}

export class UnknownRPCMethodError extends DecodingError {}

export class AuthError extends RPCError {
  recoverable = false;
}

export class RateLimitError extends RPCError {
  retryAfter?: number;

  constructor(
    message: string,
    options?: {
      retryAfter?: number;
      methodId?: string;
      rawResponse?: string;
      rpcCode?: string | number;
      foundIds?: string[];
    }
  ) {
    super(message, options);
    this.retryAfter = options?.retryAfter;
  }
}

export class ServerError extends RPCError {
  statusCode?: number;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      methodId?: string;
      rawResponse?: string;
      rpcCode?: string | number;
      foundIds?: string[];
    }
  ) {
    super(message, options);
    this.statusCode = options?.statusCode;
  }
}

export class ClientError extends RPCError {
  statusCode?: number;

  constructor(
    message: string,
    options?: {
      statusCode?: number;
      methodId?: string;
      rawResponse?: string;
      rpcCode?: string | number;
      foundIds?: string[];
    }
  ) {
    super(message, options);
    this.statusCode = options?.statusCode;
  }
}

export class RPCTimeoutError extends NetworkError {
  timeoutSeconds?: number;

  constructor(
    message: string,
    options?: {
      timeoutSeconds?: number;
      methodId?: string;
      originalError?: Error;
    }
  ) {
    super(message, { methodId: options?.methodId, originalError: options?.originalError });
    this.timeoutSeconds = options?.timeoutSeconds;
  }
}

// =============================================================================
// Domain: Notebooks
// =============================================================================

export class NotebookError extends NotebookLMError {}

export class NotebookNotFoundError extends NotebookError {
  notebookId: string;

  constructor(notebookId: string) {
    super(`Notebook not found: ${notebookId}`);
    this.notebookId = notebookId;
  }
}

// =============================================================================
// Domain: Chat
// =============================================================================

export class ChatError extends NotebookLMError {}

// =============================================================================
// Domain: Sources
// =============================================================================

export class SourceError extends NotebookLMError {}

export class SourceAddError extends SourceError {
  url: string;
  override cause?: Error;

  constructor(url: string, cause?: Error, message?: string) {
    const msg =
      message ||
      `Failed to add source: ${url}\nPossible causes:\n  - URL is invalid or inaccessible\n  - Content is behind a paywall or requires authentication\n  - Page content is empty or could not be parsed\n  - Rate limiting or quota exceeded`;
    super(msg);
    this.url = url;
    this.cause = cause;
  }
}

export class SourceNotFoundError extends SourceError {
  sourceId: string;

  constructor(sourceId: string) {
    super(`Source not found: ${sourceId}`);
    this.sourceId = sourceId;
  }
}

export class SourceProcessingError extends SourceError {
  sourceId: string;
  status: number;

  constructor(sourceId: string, status = 3, message = "") {
    super(message || `Source ${sourceId} failed to process`);
    this.sourceId = sourceId;
    this.status = status;
  }
}

export class SourceTimeoutError extends SourceError {
  sourceId: string;
  timeout: number;
  lastStatus?: number;

  constructor(sourceId: string, timeout: number, lastStatus?: number) {
    const statusInfo = lastStatus !== undefined ? ` (last status: ${lastStatus})` : "";
    super(`Source ${sourceId} not ready after ${timeout.toFixed(1)}s${statusInfo}`);
    this.sourceId = sourceId;
    this.timeout = timeout;
    this.lastStatus = lastStatus;
  }
}

// =============================================================================
// Domain: Artifacts
// =============================================================================

export class ArtifactError extends NotebookLMError {}

export class ArtifactNotFoundError extends ArtifactError {
  artifactId: string;
  artifactType?: string;

  constructor(artifactId: string, artifactType?: string) {
    const typeInfo = artifactType ? ` ${artifactType}` : "";
    super(`${typeInfo.charAt(0).toUpperCase() + typeInfo.slice(1)} artifact ${artifactId} not found`);
    this.artifactId = artifactId;
    this.artifactType = artifactType;
  }
}

export class ArtifactNotReadyError extends ArtifactError {
  artifactType: string;
  artifactId?: string;
  status?: string;

  constructor(artifactType: string, artifactId?: string, status?: string) {
    let msg: string;
    if (artifactId) {
      msg = `${artifactType.charAt(0).toUpperCase() + artifactType.slice(1)} artifact ${artifactId} is not ready`;
      if (status) {
        msg += ` (status: ${status})`;
      }
    } else {
      msg = `No completed ${artifactType} found`;
    }
    super(msg);
    this.artifactType = artifactType;
    this.artifactId = artifactId;
    this.status = status;
  }
}

export class ArtifactParseError extends ArtifactError {
  artifactType: string;
  artifactId?: string;
  details?: string;
  override cause?: Error;

  constructor(artifactType: string, options?: { details?: string; artifactId?: string; cause?: Error }) {
    let msg = `Failed to parse ${artifactType} artifact`;
    if (options?.artifactId) {
      msg += ` ${options.artifactId}`;
    }
    if (options?.details) {
      msg += `: ${options.details}`;
    }
    super(msg);
    this.artifactType = artifactType;
    this.artifactId = options?.artifactId;
    this.details = options?.details;
    this.cause = options?.cause;
  }
}

export class ArtifactDownloadError extends ArtifactError {
  artifactType: string;
  artifactId?: string;
  details?: string;
  override cause?: Error;

  constructor(artifactType: string, options?: { details?: string; artifactId?: string; cause?: Error }) {
    let msg = `Failed to download ${artifactType} artifact`;
    if (options?.artifactId) {
      msg += ` ${options.artifactId}`;
    }
    if (options?.details) {
      msg += `: ${options.details}`;
    }
    super(msg);
    this.artifactType = artifactType;
    this.artifactId = options?.artifactId;
    this.details = options?.details;
    this.cause = options?.cause;
  }
}
