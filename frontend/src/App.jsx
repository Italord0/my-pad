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
    if (!slug) return undefined

    const client = new Client({
      webSocketFactory: () => new SockJS(WS_BASE),
      reconnectDelay: 5000,
      onConnect: () => {
        client.subscribe(`/topic/pads/${slug}`, (message) => {
          const payload = JSON.parse(message.body)
          setContent((current) => (payload.content === current ? current : payload.content))
        })
      },
    })

    stompClientRef.current = client
    client.activate()

    return () => {
      client.deactivate()
      stompClientRef.current = null
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

    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`${API_BASE}/pads/${encodeURIComponent(slug)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        })

        const client = stompClientRef.current
        if (client && client.connected) {
          client.publish({
            destination: `/app/pads/${slug}`,
            body: JSON.stringify({ type: 'update', content }),
          })
        }
      } catch (error) {
        console.error('Erro ao salvar o pad', error)
      }
    }, 500)

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [content, isLoading, slug])

  return (
    <main className="app-shell">
      <div
        ref={editorRef}
        className="editor"
        contentEditable={!isLoading}
        suppressContentEditableWarning
        onInput={(event) => {
          const nextContent = event.currentTarget.innerText ?? ''
          setContent(nextContent.replace(/\u00A0/g, ' '))
        }}
        spellCheck={false}
      />
    </main>
  )
}

export default App
