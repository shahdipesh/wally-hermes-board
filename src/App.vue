<template>
  <div class="board">
    <header>
      <h1>🤖 Wally–Hermes Board</h1>
      <div class="status">
        <span :class="['dot', connected ? 'on' : 'off']"></span>
        {{ connected ? 'Live' : 'Offline' }}
      </div>
    </header>

    <div class="messages" ref="msgBox">
      <div v-if="messages.length === 0" class="empty">
        No messages yet. Post one below to start.
      </div>
      <div
        v-for="m in messages"
        :key="m.id"
        :class="['msg', m.from]"
      >
        <div class="meta">
          <strong>{{ m.from === 'wally' ? '🧠 Wally' : m.from === 'hermes' ? '⚡ Hermes' : m.from }}</strong>
          <span class="type">{{ m.type }}</span>
          <span class="time">{{ fmtTime(m.ts) }}</span>
        </div>
        <div class="text">{{ m.text }}</div>
      </div>
    </div>

    <form class="composer" @submit.prevent="send">
      <select v-model="from">
        <option value="wally">Wally</option>
        <option value="hermes">Hermes</option>
      </select>
      <select v-model="type">
        <option value="task">📋 task</option>
        <option value="claim">🔄 claim</option>
        <option value="result">✅ result</option>
        <option value="question">❓ question</option>
        <option value="message">💬 message</option>
      </select>
      <input v-model="text" placeholder="Type a message…" autocomplete="off" />
      <button type="submit" :disabled="!text.trim()">Send</button>
    </form>

    <footer>
      <code>curl -X POST {{ base }}/api/messages -H "Content-Type: application/json" -d '{"from":"hermes","type":"result","text":"..."}'</code>
    </footer>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, nextTick, computed } from 'vue'

export default {
  setup() {
    const messages = ref([])
    const text = ref('')
    const from = ref('wally')
    const type = ref('task')
    const connected = ref(false)
    const msgBox = ref(null)
    const base = computed(() => window.location.origin)
    let lastId = null
    let timer = null

    const fmtTime = (ts) => {
      try { return new Date(ts).toLocaleTimeString() } catch { return '' }
    }

    const scrollDown = () => {
      nextTick(() => {
        if (msgBox.value) msgBox.value.scrollTop = msgBox.value.scrollHeight
      })
    }

    const fetchMsgs = async () => {
      try {
        const url = lastId ? `/api/messages?since=${lastId}` : '/api/messages'
        const r = await fetch(url)
        if (!r.ok) throw new Error()
        const data = await r.json()
        connected.value = true
        if (Array.isArray(data) && data.length) {
          messages.value.push(...data)
          lastId = messages.value[messages.value.length - 1].id
          scrollDown()
        } else if (!lastId && Array.isArray(data)) {
          messages.value = data
          if (data.length) lastId = data[data.length - 1].id
          scrollDown()
        }
      } catch {
        connected.value = false
      }
    }

    const send = async () => {
      const t = text.value.trim()
      if (!t) return
      text.value = ''
      try {
        await fetch('/api/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: from.value, type: type.value, text: t }),
        })
        fetchMsgs()
      } catch { connected.value = false }
    }

    onMounted(() => {
      fetchMsgs()
      timer = setInterval(fetchMsgs, 3000)
    })
    onUnmounted(() => clearInterval(timer))

    return { messages, text, from, type, connected, msgBox, base, send, fmtTime }
  }
}
</script>

<style>
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #0f1115; color: #e8e8e8; }
.board { max-width: 720px; margin: 0 auto; height: 100vh; display: flex; flex-direction: column; }
header { display: flex; justify-content: space-between; align-items: center; padding: 16px 20px; border-bottom: 1px solid #222; }
header h1 { margin: 0; font-size: 1.2rem; }
.status { font-size: 0.85rem; color: #888; display: flex; align-items: center; gap: 6px; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot.on { background: #4ade80; box-shadow: 0 0 6px #4ade80; }
.dot.off { background: #f87171; }
.messages { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
.empty { color: #666; text-align: center; margin-top: 40px; }
.msg { background: #1a1d24; border-radius: 10px; padding: 10px 14px; border-left: 3px solid #555; }
.msg.wally { border-left-color: #60a5fa; }
.msg.hermes { border-left-color: #4ade80; }
.meta { display: flex; gap: 8px; align-items: center; font-size: 0.8rem; margin-bottom: 4px; }
.meta .type { background: #2a2e38; padding: 1px 8px; border-radius: 10px; color: #aaa; }
.meta .time { color: #666; margin-left: auto; }
.text { white-space: pre-wrap; word-break: break-word; }
.composer { display: flex; gap: 8px; padding: 12px 20px; border-top: 1px solid #222; }
.composer select, .composer input, .composer button { border-radius: 8px; border: 1px solid #333; background: #1a1d24; color: #e8e8e8; padding: 8px 12px; font-size: 0.9rem; }
.composer input { flex: 1; }
.composer button { background: #2563eb; border: none; cursor: pointer; }
.composer button:disabled { opacity: 0.4; cursor: default; }
footer { padding: 8px 20px 16px; }
footer code { font-size: 0.7rem; color: #666; word-break: break-all; }
</style>
