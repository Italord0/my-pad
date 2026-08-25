const DEFAULT_BACKEND_PORT = '5172'

export function resolveBackendOrigin({ protocol = 'http:', hostname = 'localhost', port = '' } = {}) {
  const explicitApiBase = import.meta.env?.VITE_API_BASE
  if (explicitApiBase) {
    return explicitApiBase.replace(/\/api$/, '').replace(/\/$/, '')
  }

  const explicitWsBase = import.meta.env?.VITE_WS_BASE
  if (explicitWsBase) {
    return explicitWsBase.replace(/\/ws\/pads$/, '').replace(/\/$/, '')
  }

  const localHostnames = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]']
  const isLocalDev = localHostnames.includes(hostname)

  if (isLocalDev) {
    return `${protocol}//${hostname}:${DEFAULT_BACKEND_PORT}`
  }

  const normalizedPort = port && port !== '80' && port !== '443' ? `:${port}` : ''
  return `${protocol}//${hostname}${normalizedPort}`
}

export function resolveApiBase(location = window.location) {
  return `${resolveBackendOrigin(location)}/api`
}

export function resolveSockJsBase(location = window.location) {
  return `${resolveBackendOrigin(location)}/ws/pads`
}

export function resolveWsBase(location = window.location) {
  const wsProtocol = location.protocol === 'https:' ? 'wss' : 'ws'
  const origin = resolveBackendOrigin(location)
  const normalizedOrigin = origin.replace(/^https?:\/\//, `${wsProtocol}://`)
  return `${normalizedOrigin}/ws/pads`
}
