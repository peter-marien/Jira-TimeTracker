declare namespace NodeJS {
  interface ProcessEnv {
    /**
     * The built directory structure
     *
     * ```tree
     * ├─┬─┬ dist
     * │ │ └── index.html
     * │ │
     * │ ├─┬ dist-electron
     * │ │ ├── main.js
     * │ │ └── preload.js
     * │
     * ```
     */
    APP_ROOT: string
  }
}

// Used in Renderer process, expose in `preload.ts`
interface Window {
  ipcRenderer: Pick<import('electron').IpcRenderer, 'send' | 'invoke'> & {
    on(...args: Parameters<import('electron').IpcRenderer['on']>): () => void
  }
}
