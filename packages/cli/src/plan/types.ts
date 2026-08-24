export type FileOperationKind = "create" | "modify" | "skip" | "conflict";

export interface FileIntent {
  /** Project-relative path. Absolute paths and parent traversal are rejected. */
  path: string;
  content: string;
  /** Allow replacing an existing file. Defaults to false. */
  overwrite?: boolean;
  /** When provided, replacement is allowed only if the file still has this content. */
  expectedContent?: string;
}

export interface FileOperation {
  kind: FileOperationKind;
  path: string;
  content: string;
  previousContent?: string;
  reason?: string;
}

export interface FilesystemPlan {
  version: 1;
  cwd: string;
  operations: FileOperation[];
}

export interface PublicFileOperation {
  kind: FileOperationKind;
  path: string;
  reason?: string;
}

export interface PublicFilesystemPlan {
  version: 1;
  operations: PublicFileOperation[];
  summary: Record<FileOperationKind, number>;
}
