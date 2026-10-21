import React, { useState } from 'react';
import { Mic, MicOff, Send, Bot, UserRound } from 'lucide-react';
import { PhysicalNav } from '../components/PhysicalNav';
import { sendPhysicalChat } from '../api';
import { useVoiceInput } from '../../scheduler/hooks/useVoiceInput';

const suggestions = [
  'Give me a small workout for today',
  'I have 10 minutes and no equipment',
  'What can I do to stretch?',
  'How am I doing this week?'
];

export function PhysicalCoach() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Hi! Ask me about your workouts, movement, meals, habits, or Physical Wellbeing plan. You can type or use your microphone.' }]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const voice = useVoiceInput({ onText: setInput });

  async function send(text = input) {
    const message = text.trim();
    if (!message || sending) return;
    const history = messages.slice(-10).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setInput('');
    setSending(true);
    try {
      const result = await sendPhysicalChat(message, history);
      setMessages((current) => [...current, { role: 'assistant', content: result.reply }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: error?.response?.data?.detail || 'I couldn’t reach the wellbeing service. Please try again.' }]);
    } finally {
      setSending(false);
    }
  }

  return <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
    <PhysicalNav />
    <header className="mb-4 rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-cyan-700 p-4 text-white shadow-md sm:p-5">
      <div className="flex items-center gap-3"><span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/30 bg-white text-emerald-700 shadow"><Bot size={25} strokeWidth={1.8} /><span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-emerald-700 bg-lime-300" /></span><div><h1 className="text-sm font-bold leading-snug sm:text-base">Ask a question or tell me what you need</h1><p className="mt-1 text-xs leading-relaxed text-emerald-50">Get a workout, adjust today’s plan, or ask about healthy habits.</p></div></div>
    </header>
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex h-[min(58vh,620px)] flex-col gap-4 overflow-y-auto p-4 sm:p-6" aria-live="polite">
        {messages.map((item, index) => <div key={index} className={`flex gap-3 ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
          {item.role === 'assistant' && <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><Bot size={20} /></span>}
          <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${item.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-800'}`}>{item.content}</div>
          {item.role === 'user' && <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600"><UserRound size={17} /></span>}
        </div>)}
        {sending && <p className="ml-12 text-sm text-slate-500">Thinking…</p>}
      </div>
      <div className="border-t border-slate-100 p-4 sm:p-5">
        {messages.length < 3 && <div className="mb-4 flex flex-wrap gap-2">{suggestions.map((item) => <button key={item} onClick={() => send(item)} disabled={sending} className="rounded-full border border-emerald-200 px-3 py-2 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-50">{item}</button>)}</div>}
        {voice.error && <p role="status" className="mb-2 text-xs text-rose-600">{voice.error}</p>}
        <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); send(); }}>
          {voice.supported ? <button type="button" aria-label={voice.listening ? 'Stop voice input' : 'Start voice input'} onClick={voice.toggle} title={voice.listening ? 'Stop listening' : 'Start voice input'} className={`rounded-xl p-3 ${voice.listening ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}`}>{voice.listening ? <MicOff size={19} /> : <Mic size={19} />}</button> : <span title="Voice input is supported in Chrome and Edge" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-400"><Mic size={19} /></span>}
          <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); send(); } }} rows={1} maxLength={1200} placeholder="Ask or tell me what you need…" className="max-h-32 min-h-12 flex-1 resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
          <button type="submit" disabled={sending || !input.trim()} aria-label="Send message" className="rounded-xl bg-emerald-600 p-3 text-white transition hover:bg-emerald-700 disabled:opacity-40"><Send size={19} /></button>
        </form>
        <p className="mt-2 text-xs text-slate-500">{voice.supported ? 'Tap the mic, speak, tap it again to stop, then send your message.' : 'Voice input needs Chrome or Edge. You can still type your message here.'}</p>
        <p className="mt-2 text-xs text-slate-500">For health concerns or pain, talk with a qualified health professional.</p>
      </div>
    </section>
  </main>;
}
