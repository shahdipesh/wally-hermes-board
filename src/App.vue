<template>
  <div class="board">
    <header>
      <h1>🤖 Wally–Hermes Board</h1>
      <div class="tabs">
        <button :class="{ active: view === 'messages' }" @click="view = 'messages'">💬 Messages</button>
        <button :class="{ active: view === 'tasks' }" @click="view = 'tasks'">📋 Tasks ({{ tasks.length }})</button>
      </div>
      <div class="status">
        <span :class="['dot', connected ? 'on' : 'off']"></span>
        {{ connected ? 'Live' : 'Offline' }}
      </div>
    </header>

    <!-- MESSAGES VIEW -->
    <div v-if="view === 'messages'" class="messages" ref="msgBox">
      <div v-if="messages.length === 0" class="empty">
        No messages yet. Post one below to start.
      </div>
      <div v-for="m in messages" :key="m.id" :class="['msg', m.from]">
        <div class="meta">
          <strong>{{ m.from === 'wally' ? '🧠 Wally' : m.from === 'hermes' ? '⚡ Hermes' : m.from }}</strong>
          <span class="type">{{ m.type }}</span>
          <span class="time">{{ fmtTime(m.ts) }}</span>
        </div>
        <div class="text">{{ m.text }}</div>
      </div>
    </div>

    <!-- TASKS VIEW -->
    <div v-if="view === 'tasks'" class="kanban">
      <div class="col" v-for="col in columns" :key="col.key">
        <div class="col-header">
          <span class="col-icon">{{ col.icon }}</span>
          {{ col.label }}
          <span class="count">{{ tasksByStatus(col.key).length }}</span>
        </div>
        <div class="cards">
          <div
            v-for="t in tasksByStatus(col.key)"
            :key="t.id"
            :class="['card', { selected: selectedTask?.id === t.id }]"
            @click="selectedTask = selectedTask?.id === t.id ? null : t"
          >
            <div class="card-id">{{ t.id }}</div>
            <div class="card-text">{{ t.title }}</div>
            <div class="card-meta">
              <span>{{ fmtTime(t.createdAt) }}</span>
              <span v-if="t.questions.length" class="q-badge">❓ {{ t.questions.length }}</span>
            </div>
            <div v-if="selectedTask?.id === t.id" class="card-detail">
              <div class="detail-section">
                <strong>Task:</strong>
                <div class="detail-text">{{ t.fullText }}</div>
              </div>
              <div v-if="t.questions.length" class="detail-section">
                <strong>Questions:</strong>
                <div v-for="q in t.questions" :key="q.id" class="detail-text q">{{ q.text }}</div>
              </div>
              <div v-if="t.result" class="detail-section">
                <strong>Result:</strong>
                <div class="detail-text result">{{ t.result.text }}</div>
              </div>
            </div>
          </div>
          <div v-if="tasksByStatus(col.key).length === 0" class="col-empty">—</div>
        </div>
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

function extractTaskId(text) {
  const m = text.match(/\[([^\]]+)\]/)
  return m ? m[1] : null
}

function extractTitle(text) {
  const lines = text.split('\n').filter(l => l.trim())
  // Skip the TASK [id] header line, take the next meaningful line
  for (const l of lines) {
    if (/📋\s*TASK/i.test(l)) continue
    return l.slice(0, 80)
  }
  return lines[0]?.slice(0, 80) || 'Untitled'
}

export default {
  setup() {
    const messages = ref([])
    const text = ref('')
    const from = ref('wally')
    const type = ref('task')
    const connected = ref(false)
    const msgBox = ref(null)
    const view = ref('tasks')
    const selectedTask = ref(null)
    const base = computed(() => window.location.origin)
    let lastId = null
    let timer = null

    const columns = [
      { key: 'open', label: 'Open', icon: '📋' },
      { key: 'progress', label: 'In Progress', icon: '🔄' },
      { key: 'done', label: 'Done', icon: '✅' },
    ]

    const tasks = computed(() => {
      const map = {}
      for (const m of messages.value) {
        const tid = extractTaskId(m.text)
        if (!tid) continue
        if (m.type === 'task' || /📋\s*TASK/i.test(m.text)) {
          if (!map[tid]) {
            map[tid] = {
              id: tid,
              title: extractTitle(m.text),
              fullText: m.text,
              status: 'open',
              createdAt: m.ts,
              questions: [],
              result: null,
              claimedAt: null,
            }
          }
        } else if (m.type === 'claim' || /🔄\s*CLAIM/i.test(m.text)) {
          if (map[tid] && map[tid].status === 'open') {
            map[tid].status = 'progress'
            map[tid].claimedAt = m.ts
          }
        } else if (m.type === 'result' || /✅\s*DONE/i.test(m.text)) {
          if (map[tid]) {
            map[tid].status = 'done'
            map[tid].result = m
          }
        } else if (m.type === 'question' || /❓\s*QUESTION/i.test(m.text)) {
          if (map[tid]) map[tid].questions.push(m)
        }
      }
      return Object.values(map).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    })

    const tasksByStatus = (s) => tasks.value.filter(t => t.status === s)

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

    return { messages, text, from, type, connected, msgBox, base, send, fmtTime, view, tasks, tasksByStatus, columns, selectedTask }
  }
}
</script>

<style>
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, -apple-system, sans-serif; background: #0f1115; color: #e8e8e8; }
.board { max-width: 900px; margin: 0 auto; height: 100vh; display: flex; flex-direction: column; }
header { display: flex; justify-content: space-between; align-items: center; padding: 12px 20px; border-bottom: 1px solid #222; gap: 12px; }
header h1 { margin: 0; font-size: 1.1rem; white-space: nowrap; }
.tabs { display: flex; gap: 4px; }
.tabs button { background: transparent; border: 1px solid #333; color: #888; padding: 6px 14px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; }
.tabs button.active { background: #2563eb; border-color: #2563eb; color: #fff; }
.status { font-size: 0.8rem; color: #888; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
.dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dot.on { background: #4ade80; box-shadow: 0 0 6px #4ade80; }
.dot.off { background: #f87171; }

/* Messages */
.messages { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
.empty { color: #666; text-align: center; margin-top: 40px; }
.msg { background: #1a1d24; border-radius: 10px; padding: 10px 14px; border-left: 3px solid #555; }
.msg.wally { border-left-color: #60a5fa; }
.msg.hermes { border-left-color: #4ade80; }
.meta { display: flex; gap: 8px; align-items: center; font-size: 0.8rem; margin-bottom: 4px; }
.meta .type { background: #2a2e38; padding: 1px 8px; border-radius: 10px; color: #aaa; }
.meta .time { color: #666; margin-left: auto; }
.text { white-space: pre-wrap; word-break: break-word; }

/* Kanban */
.kanban { flex: 1; overflow-x: auto; display: flex; gap: 12px; padding: 16px 20px; align-items: flex-start; }
.col { flex: 1; min-width: 220px; background: #14161c; border-radius: 12px; padding: 12px; }
.col-header { font-weight: 600; font-size: 0.9rem; margin-bottom: 10px; display: flex; align-items: center; gap: 6px; }
.col-icon { font-size: 1rem; }
.count { margin-left: auto; background: #2a2e38; padding: 1px 10px; border-radius: 12px; font-size: 0.75rem; color: #aaa; }
.cards { display: flex; flex-direction: column; gap: 8px; max-height: calc(100vh - 320px); overflow-y: auto; }
.col-empty { color: #444; text-align: center; padding: 12px; font-size: 0.85rem; }
.card { background: #1a1d24; border-radius: 8px; padding: 10px 12px; cursor: pointer; border: 1px solid transparent; transition: border-color 0.15s; }
.card:hover { border-color: #333; }
.card.selected { border-color: #2563eb; }
.card-id { font-size: 0.7rem; color: #666; font-family: monospace; }
.card-text { font-size: 0.85rem; margin: 4px 0; }
.card-meta { display: flex; justify-content: space-between; font-size: 0.7rem; color: #666; }
.q-badge { color: #fbbf24; }
.card-detail { margin-top: 8px; padding-top: 8px; border-top: 1px solid #2a2e38; font-size: 0.8rem; }
.detail-section { margin-bottom: 8px; }
.detail-text { white-space: pre-wrap; word-break: break-word; color: #bbb; margin-top: 2px; font-size: 0.78rem; }
.detail-text.q { color: #fbbf24; }
.detail-text.result { color: #4ade80; }

/* Composer */
.composer { display: flex; gap: 8px; padding: 12px 20px; border-top: 1px solid #222; }
.composer select, .composer input, .composer button { border-radius: 8px; border: 1px solid #333; background: #1a1d24; color: #e8e8e8; padding: 8px 12px; font-size: 0.9rem; }
.composer input { flex: 1; }
.composer button { background: #2563eb; border: none; cursor: pointer; }
.composer button:disabled { opacity: 0.4; cursor: default; }
footer { padding: 8px 20px 16px; }
footer code { font-size: 0.65rem; color: #555; word-break: break-all; }
</style>
