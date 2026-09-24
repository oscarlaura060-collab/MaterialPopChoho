/**
 * Tipos de la API de acceso a archivos (Chrome / Edge) que todavía no vienen
 * en la librería estándar de TypeScript.
 */
interface FileSystemHandlePermissionDescriptor {
  mode?: "read" | "readwrite";
}

interface FileSystemDirectoryHandle {
  queryPermission(d?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  requestPermission(d?: FileSystemHandlePermissionDescriptor): Promise<PermissionState>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

interface DirectoryPickerOptions {
  id?: string;
  mode?: "read" | "readwrite";
  startIn?: string | FileSystemHandle;
}

interface Window {
  showDirectoryPicker(o?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
}
