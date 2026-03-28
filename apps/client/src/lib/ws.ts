import type { WSEventOp } from '@aicord/shared'

type EventHandler<T = unknown> = (payload: T) => void

class WSClient {
  private ws: WebSocket | null = null
  private token: string | null = null
  private reconnectDelay = 1000
  private readonly maxReconnectDelay = 30000
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null
  private handlers = new Map<string, Set<EventHandler>>()
  private isDestroyed = false

  connect(token: string) {
    this.token = token
    this.isDestroyed = false
    this._connect()
  }

  private _connect() {
    if (this.isDestroyed || !this.token) return
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const url = `${protocol}//${window.location.host}/ws?token=${this.token}`
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.reconnectDelay = 1000
      this._startHeartbeat()
      this._emit('CONNECTED', {})
    }

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string)
        this._emit(msg.op, msg.d)
      } catch {
        // ignore
      }
    }

    this.ws.onclose = () => {
      this._stopHeartbeat()
      this._emit('DISCONNECTED', {})
      if (!this.isDestroyed) {
        this.reconnectTimeout = setTimeout(() => {
          this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay)
          this._connect()
        }, this.reconnectDelay)
      }
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  private _startHeartbeat() {
    this._stopHeartbeat()
    this.heartbeatInterval = setInterval(() => {
      this.send('HEARTBEAT', {})
    }, 30000)
  }

  private _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }
  }

  send(op: string, data: unknown) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ op, d: data, t: Date.now() }))
    }
  }

  on<T>(op: WSEventOp | string, handler: EventHandler<T>) {
    if (!this.handlers.has(op)) {
      this.handlers.set(op, new Set())
    }
    this.handlers.get(op)!.add(handler as EventHandler)
    return () => this.off(op, handler)
  }

  off<T>(op: WSEventOp | string, handler: EventHandler<T>) {
    this.handlers.get(op)?.delete(handler as EventHandler)
  }

  private _emit(op: string, data: unknown) {
    const handlers = this.handlers.get(op)
    if (handlers) {
      for (const handler of handlers) handler(data)
    }
  }

  subscribe(channelId: string) {
    this.send('SUBSCRIBE', { channelId })
  }

  unsubscribe(channelId: string) {
    this.send('UNSUBSCRIBE', { channelId })
  }

  destroy() {
    this.isDestroyed = true
    this._stopHeartbeat()
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout)
    this.ws?.close()
    this.handlers.clear()
  }
}

export const wsClient = new WSClient()
