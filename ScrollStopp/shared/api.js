// One name for the extension API in every browser. Firefox and Safari expose
// the promise based `browser` object, Chrome, Edge, Opera and Brave expose `chrome`.
export const ext = globalThis.browser ?? globalThis.chrome;
