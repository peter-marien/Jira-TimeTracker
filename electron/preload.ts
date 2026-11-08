import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    const wrapped: Parameters<typeof ipcRenderer.on>[1] = (event, ...values) => listener(event, ...values)
    ipcRenderer.on(channel, wrapped)
    // Callback proxies are not identity-stable across contextBridge calls.
    // Return cleanup tied to this exact registration instead.
    return () => { ipcRenderer.removeListener(channel, wrapped) }
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

})
