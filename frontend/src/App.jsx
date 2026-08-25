import { useEffect, useMemo, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import { resolveApiBase, resolveSockJsBase } from './networkConfig'
import './App.css'

const API_BASE = resolveApiBase()
const WS_BASE = resolveSockJsBase()

function App() {
  const [content, setContent] = useState('')
  const [children, setChildren] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const saveTimeoutRef = useRef(null)
  const stompClientRef = useRef(null)
  const editorRef = useRef(null)
  const lastLocalEditRef = useRef(0)
  const pendingRemoteRef = useRef(null)
  const pendingApplyTimerRef = useRef(null)
  const clientIdRef = useRef(null)
  const savingRef = useRef(false)
  const pendingSaveRef = useRef(false)
  const pendingSaveContentRef = useRef(null)
  const currentBundleRef = useRef(null)
  const currentBundleTimerRef = useRef(null)
  const pendingBundlesRef = useRef([])
  const performSaveRef = useRef(null)

  function generateClientId() {
    // simple UUIDv4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  const slug = useMemo(() => {
    const path = window.location.pathname.replace(/^\//, '')
    return path === '' ? null : path
  }, [])

  useEffect(() => {
    const loadPad = async () => {
      if (!slug) {
        // root: show welcome screen
        setContent('')
        setChildren([])
        setIsLoading(false)
        return
      }

      try {
        const response = await fetch(`${API_BASE}/pads/${encodeURI(slug)}`)
        const pad = await response.json()
        setContent(pad.content || '')
        setChildren(pad.children || [])
      } catch (error) {
        console.error('Erro ao carregar o pad', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadPad()
  }, [slug])

  useEffect(() => {
    if (!clientIdRef.current) {
      const stored = sessionStorage.getItem('mypad_clientId')
      clientIdRef.current = stored || generateClientId()
      sessionStorage.setItem('mypad_clientId', clientIdRef.current)
    }
  }, [])

  useEffect(() => {
    if (!slug) return undefined

    function getCaretCharacterOffsetWithin(element) {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0) return 0
      // try to compute using text nodes for accuracy
      try {
        element.normalize()
        const focusNode = sel.focusNode
        const focusOffset = sel.focusOffset
        if (focusNode && focusNode.nodeType === Node.TEXT_NODE) {
          let walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)
          let node = null
          let offset = 0
          while ((node = walker.nextNode())) {
            if (node === focusNode) {
              return offset + focusOffset
            }
            offset += node.textContent ? node.textContent.length : 0
          }
          return offset
        }
      } catch (e) {
        // fallback below
      }

      const range = sel.getRangeAt(0).cloneRange()
      const preRange = range.cloneRange()
      preRange.selectNodeContents(element)
      preRange.setEnd(range.endContainer, range.endOffset)
      return preRange.toString().length
    }

    function setCaretPosition(element, chars) {
      if (!element) return
      try {
        element.normalize()
        let walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null)
        let node = null
        let remaining = Math.max(0, Math.floor(chars))
        while ((node = walker.nextNode())) {
          const len = node.textContent ? node.textContent.length : 0
          if (remaining <= len) {
            const range = document.createRange()
            range.setStart(node, remaining)
            range.collapse(true)
            const sel = window.getSelection()
            sel.removeAllRanges()
            sel.addRange(range)
            return
          }
          remaining -= len
        }
      } catch (e) {
        // ignore and fallback
      }

      const range = document.createRange()
      range.selectNodeContents(element)
      range.collapse(false)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
    }

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_BASE),
      reconnectDelay: 5000,
      debug: (str) => console.debug('[STOMP]', str),
      onConnect: () => {
        console.debug('[STOMP] connected', { slug })
        client.subscribe(`/topic/pads/${slug}`, (message) => {
          try {
            const payload = JSON.parse(message.body)
            console.log('[SOCKET] message received for slug:', slug)
            console.log('[SOCKET] payload:', payload)
            console.log('[SOCKET] incoming content:', payload.content)
            console.debug('[STOMP] message received', message)
            // if user is actively typing (recent local edits) and editor is focused,
            // buffer the remote update and apply after a short idle period to avoid
            // clobbering the user's in-progress edit.
            const el = editorRef.current
            const REMOTE_APPLY_DELAY = 800
            const now = Date.now()

            const applyRemote = (remoteContent) => {
              const element = editorRef.current
              if (!element) return
              console.log('[SOCKET] applying remote content:', remoteContent)
              const prevCaret = getCaretCharacterOffsetWithin(element)
              element.innerText = remoteContent
              setContent((current) => (remoteContent === current ? current : remoteContent))
              setCaretPosition(element, Math.min(prevCaret, remoteContent.length))
            }

            // ignore messages that originated from this client
            if (payload.senderId && payload.senderId === clientIdRef.current) {
              return
            }

            if (el && document.activeElement === el && now - (lastLocalEditRef.current || 0) < REMOTE_APPLY_DELAY) {
              // buffer remote update but only apply when the user truly idles
              pendingRemoteRef.current = { content: payload.content, ts: now }
              if (pendingApplyTimerRef.current) clearTimeout(pendingApplyTimerRef.current)

              const scheduleApply = () => {
                const pending = pendingRemoteRef.current
                if (!pending) return
                // if the editor is focused and there were recent local edits, defer
                const elapsedSinceLocal = Date.now() - (lastLocalEditRef.current || 0)
                if (document.activeElement === el && elapsedSinceLocal < REMOTE_APPLY_DELAY) {
                  pendingApplyTimerRef.current = setTimeout(scheduleApply, REMOTE_APPLY_DELAY)
                  return
                }

                // safe to apply
                pendingRemoteRef.current = null
                pendingApplyTimerRef.current = null
                applyRemote(pending.content)
              }

              pendingApplyTimerRef.current = setTimeout(scheduleApply, REMOTE_APPLY_DELAY)
            } else {
              // apply immediately
              applyRemote(payload.content)
            }
          } catch (err) {
            console.error('[STOMP] failed to apply message', err)
          }
        })
      },
      onStompError: (frame) => console.error('[STOMP] error', frame),
      onDisconnect: (frame) => console.debug('[STOMP] disconnected', frame),
    })

    stompClientRef.current = client
    client.activate()

    return () => {
      client.deactivate()
      stompClientRef.current = null
      if (pendingApplyTimerRef.current) {
        clearTimeout(pendingApplyTimerRef.current)
        pendingApplyTimerRef.current = null
      }
      pendingRemoteRef.current = null
    }
  }, [slug])

  useEffect(() => {
    if (isLoading || !editorRef.current) return

    if (document.activeElement !== editorRef.current) {
      editorRef.current.innerText = content
    }
  }, [content, isLoading])

  useEffect(() => {
    if (isLoading || !slug) return undefined

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    async function performSave(latestContent) {
      if (savingRef.current) {
        // queue this bundle content for later
        pendingBundlesRef.current.push(latestContent)
        return
      }

      savingRef.current = true
      try {
        const res = await fetch(`${API_BASE}/pads/${encodeURI(slug)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'X-Sender-Id': clientIdRef.current },
          body: JSON.stringify({ content: latestContent }),
        })

        if (!res.ok) {
          throw new Error(`Save failed: ${res.status}`)
        }

        const client = stompClientRef.current
        console.debug('[STOMP] publish attempt', { connected: client?.connected, slug })
        if (client && client.connected) {
          client.publish({
            destination: `/app/pads/${slug}`,
            body: JSON.stringify({ type: 'update', content: latestContent, senderId: clientIdRef.current }),
          })
          console.debug('[STOMP] published', { slug })
        } else {
          console.warn('[STOMP] not connected, skipping publish', { slug })
        }
      } catch (error) {
        console.error('Erro ao salvar o pad', error)
      } finally {
        savingRef.current = false
        // if there are queued bundles, send the next one
        if (pendingBundlesRef.current.length > 0) {
          const next = pendingBundlesRef.current.shift()
          performSave(next)
        }
      }
    }

    // expose performSave to input timers
    performSaveRef.current = performSave

    saveTimeoutRef.current = setTimeout(() => {
      // if there is a current bundle ready (timer expired will push it), but
      // otherwise, if no bundle flow is used, fall back to sending current content
      if (pendingBundlesRef.current.length > 0) {
        if (!savingRef.current) {
          const next = pendingBundlesRef.current.shift()
          performSave(next)
        }
      } else {
        performSave(content)
      }
    }, 500)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [content, isLoading, slug])

  useEffect(() => {
    return () => {
      if (currentBundleTimerRef.current) {
        clearTimeout(currentBundleTimerRef.current)
        currentBundleTimerRef.current = null
      }
      if (pendingApplyTimerRef.current) {
        clearTimeout(pendingApplyTimerRef.current)
        pendingApplyTimerRef.current = null
      }
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = null
      }
    }
  }, [])

  return (
    <main className="app-shell">
      {!slug ? (
        <div className="welcome">
          <div className="welcome-box">
            <h1>Welcome to MyPad</h1>
            <div className="welcome-actions">
            <p>{window.location.origin}/</p>
              <input
                aria-label="slug"
                className="slug-input"
                placeholder="your-secret-page"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = e.currentTarget.value.trim().replace(/^\/+|\/+$/g, '')
                    if (v) window.location.href = `/${encodeURI(v)}`
                  }
                }}
              />
              <button
                className="join-btn"
                onClick={() => {
                  const el = document.querySelector('.slug-input')
                  const v = el?.value.trim().replace(/^\/+|\/+$/g, '')
                  if (v) window.location.href = `/${encodeURI(v)}`
                }}
              >
                GO!
              </button>
            </div>
          </div>
          <a
            className="github-link"
            href="https://github.com/Italord0/my-pad"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open project on GitHub"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M12 .5C5.73.5.5 5.73.5 12.02c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.7.08-.7 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.73 1.27 3.4.97.11-.76.41-1.27.75-1.56-2.55-.29-5.23-1.28-5.23-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.04 11.04 0 0 1 2.9-.39c.98 0 1.97.13 2.9.39 2.2-1.5 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.82 1.19 1.84 1.19 3.1 0 4.43-2.69 5.4-5.25 5.69.42.36.8 1.08.8 2.18 0 1.57-.01 2.83-.01 3.22 0 .31.21.68.8.56C20.21 21.4 23.5 17.09 23.5 12.02 23.5 5.73 18.27.5 12 .5z" />
            </svg>
          </a>
        </div>
      ) : (
        <div className="layout">
        {children && children.length > 0 && (
          <aside className="sidebar">
            <ul className="sidebar-list">
              {children.map((c) => {
                const label = String(c).split('/').pop()
                return (
                  <li key={c} className="sidebar-item">
                    <a href={`/${c}`}>{label}</a>
                  </li>
                )
              })}
            </ul>
          </aside>
        )}

        <div
          ref={editorRef}
          className="editor"
          contentEditable={!isLoading}
          suppressContentEditableWarning
          onInput={(event) => {
          const nextContent = event.currentTarget.innerText ?? ''
          lastLocalEditRef.current = Date.now()

          // manage typing bundles: create or update current bundle and reset idle timer
          if (!currentBundleRef.current) {
            currentBundleRef.current = { id: Date.now().toString(36) + Math.random().toString(36).slice(2), content: nextContent }
          } else {
            currentBundleRef.current.content = nextContent
          }

          if (currentBundleTimerRef.current) {
            clearTimeout(currentBundleTimerRef.current)
          }
          currentBundleTimerRef.current = setTimeout(() => {
            const bundle = currentBundleRef.current
            currentBundleRef.current = null
            currentBundleTimerRef.current = null
            if (bundle) {
              pendingBundlesRef.current.push(bundle.content)
              // if no save in progress, start sending immediately
              if (performSaveRef.current && !savingRef.current) {
                const next = pendingBundlesRef.current.shift()
                if (next != null) performSaveRef.current(next)
              }
            }
          }, 3000)

          // update visible content state immediately
          setContent(nextContent.replace(/\u00A0/g, ' '))
        }}
        spellCheck={false}
      />
        </div>
      )}
    </main>
  )
}

export default App
