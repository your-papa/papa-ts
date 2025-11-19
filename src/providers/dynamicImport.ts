export const dynamicImport = new Function('modulePath', 'return import(modulePath);') as <T>(modulePath: string) => Promise<T>;

