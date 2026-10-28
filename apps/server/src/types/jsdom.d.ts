// @types/jsdom pulls the browser DOM types into the whole server, where they clash with Bun's
// (WebSocket, fetch). Only the surface the PO token minter uses is declared here.
declare module 'jsdom' {
  export class VirtualConsole {}

  export interface ConstructorOptions {
    url?: string;
    runScripts?: 'dangerously' | 'outside-only';
    pretendToBeVisual?: boolean;
    virtualConsole?: VirtualConsole;
  }

  export interface DOMWindow {
    eval(script: string): unknown;
    close(): void;
  }

  export class JSDOM {
    constructor(html?: string, options?: ConstructorOptions);
    get window(): DOMWindow;
  }
}
