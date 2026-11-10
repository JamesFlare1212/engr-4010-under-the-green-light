/** UTF-8 bytes, not JS string length. Store budgets pretty JSON plus normalized recovery headroom. */
export const maxArchiveBytes = 32 * 1024 * 1024;
export const maxCommandRequestBytes = 1024 * 1024;
// save is an object, not a JSON string: its escapes are not doubled in { name, save }.
// 1 KiB covers the wrapper and a 32-code-unit name even if every code unit is escaped.
export const maxImportRequestBytes = maxArchiveBytes + 1024;
export const utf8Bytes = (text: string): number => new TextEncoder().encode(text).byteLength;
export const stringifyArchive = (archive: unknown): string => JSON.stringify(archive, null, 2);
