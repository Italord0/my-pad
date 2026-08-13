import { useEffect, useMemo, useRef, useState } from 'react'
import { Client } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import './App.css'

const API_BASE = 'http://localhost:8080/api'
const WS_BASE = 'http://localhost:8080/ws/pads'

function App() {
  const [content, setContent] = useState('')
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
    const path = window.location.pathname.replace(/^\//, '') || 'meu-pad'
    return path
  }, [])

  useEffect(() => {
    const loadPad = async () => {
      try {
        const response = await fetch(`${API_BASE}/pads/${encodeURIComponent(slug)}`)
        const pad = await response.json()
        setContent(pad.content || '')
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
            console.debug('[STOMP] message received', message)
            const payload = JSON.parse(message.body)
            // if user is actively typing (recent local edits) and editor is focused,
            // buffer the remote update and apply after a short idle period to avoid
            // clobbering the user's in-progress edit.
            const el = editorRef.current
            const REMOTE_APPLY_DELAY = 800
            const now = Date.now()

            const applyRemote = (remoteContent) => {
              const element = editorRef.current
              if (!element) return
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
              // buffer remote update
              pendingRemoteRef.current = payload.content
              if (pendingApplyTimerRef.current) clearTimeout(pendingApplyTimerRef.current)
              pendingApplyTimerRef.current = setTimeout(() => {
                const remote = pendingRemoteRef.current
                pendingRemoteRef.current = null
                pendingApplyTimerRef.current = null
                if (remote != null) applyRemote(remote)
              }, REMOTE_APPLY_DELAY)
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
    if (isLoading) return undefined

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
        const res = await fetch(`${API_BASE}/pads/${encodeURIComponent(slug)}`, {
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
    </main>
  )
}

export default App
