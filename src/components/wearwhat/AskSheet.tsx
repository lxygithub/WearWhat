// 衣橱问答弹层：聊天式 UI，LLM 实时回答（离线自动降级本地统计，来源有标注）
'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircleQuestion, SendHorizontal } from 'lucide-react'
import { api, type AskResponse } from './api'
import { COPY } from './constants'
import { useWW } from './store'
import { ItemThumb } from './ui-bits'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { cn } from '@/lib/utils'

type AskItem = AskResponse['items'][number]

interface ChatMsg {
  id: string
  role: 'user' | 'assistant'
  text: string
  items?: AskItem[]
  followUps?: string[]
  source?: AskResponse['source']
  failed?: boolean
}

const SUGGESTIONS = [
  '我有几件白衬衫？',
  '哪件外套最久没穿？',
  '最常穿的是哪几件？',
  '今天穿什么？',
]

let msgSeq = 0
function nextId(): string {
  msgSeq += 1
  return `m${Date.now()}_${msgSeq}`
}

export function AskSheet() {
  const { closeSheet, weather, season } = useWW()
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      id: 'greet',
      role: 'assistant',
      text: '问吧。衣柜里的事，我比你还清楚。',
      followUps: SUGGESTIONS,
    },
  ])
  const [input, setInput] = useState('')
  const [pending, setPending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, pending])

  const send = async (raw: string) => {
    const q = raw.trim()
    if (!q || pending) return
    setInput('')
    setMessages((m) => [...m, { id: nextId(), role: 'user', text: q }])
    setPending(true)
    try {
      const r = await api.ask(q, {
        weather,
        season,
        history: historyRef.current.slice(-6),
      })
      historyRef.current = [
        ...historyRef.current,
        { role: 'user', content: q },
        { role: 'assistant', content: r.answer },
      ]
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          role: 'assistant',
          text: r.answer,
          items: r.items.length ? r.items : undefined,
          followUps: r.followUps.length ? r.followUps : undefined,
          source: r.source,
        },
      ])
    } catch (e) {
      setMessages((m) => [
        ...m,
        {
          id: nextId(),
          role: 'assistant',
          failed: true,
          text: e instanceof Error ? e.message : '没答上来，再问一次。',
        },
      ])
    } finally {
      setPending(false)
    }
  }

  return (
    <Drawer open onOpenChange={(v) => !v && closeSheet()}>
      <DrawerContent className="h-[90dvh]">
        <div className="mx-auto flex h-full w-full max-w-md flex-col">
          <DrawerHeader className="px-4 pb-2 pt-2 text-left">
            <DrawerTitle className="flex items-center gap-2 text-base font-black">
              <MessageCircleQuestion className="h-4 w-4 text-orange-600" />
              衣橱问答
            </DrawerTitle>
            <DrawerDescription className="text-xs">{COPY.slogan}</DrawerDescription>
          </DrawerHeader>

          {/* 消息列表 */}
          <div
            ref={scrollRef}
            className="ww-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-1"
            aria-live="polite"
          >
            {messages.map((m) => (
              <MessageBubble key={m.id} msg={m} onFollowUp={(q) => void send(q)} />
            ))}
            {pending && <TypingBubble />}
          </div>

          {/* 输入区 */}
          <form
            className="flex items-center gap-2 border-t border-stone-200 bg-background px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
            onSubmit={(e) => {
              e.preventDefault()
              void send(input)
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="问点什么，比如：我有几件白衬衫？"
              maxLength={200}
              disabled={pending}
              aria-label="输入你的问题"
              className="h-11 min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-3.5 text-sm text-stone-800 outline-none transition-colors placeholder:text-stone-300 focus:border-orange-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={pending || !input.trim()}
              aria-label="发送问题"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-stone-900 text-white shadow-sm transition-all hover:bg-stone-800 active:scale-95 disabled:opacity-40"
            >
              <SendHorizontal className="h-4 w-4" />
            </button>
          </form>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

function MessageBubble({ msg, onFollowUp }: { msg: ChatMsg; onFollowUp: (q: string) => void }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] rounded-2xl rounded-br-md bg-stone-900 px-3.5 py-2.5 text-sm leading-relaxed text-white shadow-sm">
          {msg.text}
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col items-start gap-2">
      <div
        className={cn(
          'max-w-[88%] rounded-2xl rounded-bl-md border px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
          msg.failed
            ? 'border-red-200 bg-red-50/70 text-red-700'
            : 'border-stone-200 bg-white text-stone-800',
        )}
      >
        <p>{msg.text}</p>
        {msg.source === 'local' && !msg.failed && (
          <p className="mt-1.5 flex items-center gap-1 text-[10px] text-stone-400">
            <span className="rounded bg-stone-100 px-1.5 py-0.5 font-medium">离线统计</span>
            没连上大模型，这是本地算的
          </p>
        )}
      </div>

      {/* 引用单品缩略卡 */}
      {msg.items && msg.items.length > 0 && (
        <div className="flex w-full gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {msg.items.map((it) => (
            <div key={it.id} className="w-16 shrink-0">
              <div className="h-20 w-16 overflow-hidden rounded-lg border border-stone-100">
                <ItemThumb item={it} />
              </div>
              <p className="mt-1 truncate text-center text-[10px] text-stone-400" title={it.name ?? ''}>
                {it.name || '单品'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* 追问建议 */}
      {msg.followUps && msg.followUps.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {msg.followUps.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => onFollowUp(q)}
              className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 shadow-sm transition-all hover:border-orange-300 hover:text-orange-600 active:scale-95"
            >
              {q}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-stone-200 bg-white px-4 py-3 shadow-sm" aria-label="对方正在输入">
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:0ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:150ms]" />
        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-stone-400 [animation-delay:300ms]" />
      </div>
    </div>
  )
}
