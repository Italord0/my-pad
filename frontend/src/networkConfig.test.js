import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveApiBase, resolveSockJsBase, resolveWsBase } from './networkConfig.js'

test('dev client should use the backend origin for API and SockJS traffic', () => {
  assert.equal(resolveApiBase({ protocol: 'http:', hostname: 'localhost', port: '5173' }), 'http://localhost:5172/api')
  assert.equal(resolveSockJsBase({ protocol: 'http:', hostname: 'localhost', port: '5173' }), 'http://localhost:5172/ws/pads')
  assert.equal(resolveWsBase({ protocol: 'https:', hostname: 'example.com', port: '443' }), 'wss://example.com/ws/pads')
})
