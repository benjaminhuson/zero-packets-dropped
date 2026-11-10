import { useEffect, useRef, useState } from 'react';
import type { JourneyState } from '../store';
import { Horse } from './Horse';
import type { Slot } from '../calendar';


type Props = {
  state: JourneyState;
  onAsk: (q: string) => void;
  onSendToManager: (q: string) => void;
  onMessage: (who: 'manager' | 'buddy', text: string) => void;
  onNotifyActions: () => void;
  onBookCheckIn: (stage: number, slot: Slot) => void;
  // Optional controlled open state, so other parts of the screen can open the chat
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const SUGGESTIONS = ['Where am I?', 'Book a Teams meeting', 'Message my manager', 'Message my buddy', "What's next?", 'Tell me about our values', 'Who is my buddy?', 'I need holiday information'];

export function CancaraChat({ state, onAsk, onSendToManager, onMessage, onNotifyActions, onBookCheckIn, open: openProp, onOpenChange }: Props) {
  const [compose, setCompose] = useState<'manager' | 'buddy' | null>(null);
  const [innerOpen, setInnerOpen] = useState(false);
  const open = openProp ?? innerOpen;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setInnerOpen(v));
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, state.chat.length]);

  // The most recent question Cancara could not fully answer, so it can be passed to the manager
  const lastEscalation = [...state.chat].reverse().find((m) => m.from === 'cancara' && m.escalate);
  const lastQuestion = lastEscalation
    ? [...state.chat].slice(0, state.chat.indexOf(lastEscalation)).reverse().find((m) => m.from === 'you')
    : undefined;

  // An end-of-stage offer that has not been answered yet
  const offerWaiting = state.chat.some((m) => m.action?.kind === 'checkin');

  const send = (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) return;
    if (compose) {
      onMessage(compose, trimmed);
      setCompose(null);
      setText('');
      return;
    }
    onAsk(trimmed);
    setText('');
  };

  // Chips that start a message to the manager or buddy, rather than asking a question
  const pick = (s: string) => {
    if (s === 'Message my manager') return setCompose('manager');
    if (s === 'Message my buddy') return setCompose('buddy');
    send(s);
  };

  return (
    <>
      <button className={`cancara-fab${offerWaiting ? ' has-offer' : ''}`} onClick={() => setOpen(true)} aria-label="Ask Cancara, your digital buddy">
        <Horse size={40} />
        <span>Ask Cancara · Stage {state.viewStage}</span>
      </button>

      {open && (
        <div className="chat-wrap" role="dialog" aria-modal="true" aria-label="Chat with Cancara">
          <button className="drawer-scrim" aria-label="Close chat" onClick={() => setOpen(false)} />
          <section className="chat-sheet">
            <header className="chat-head">
              <Horse size={38} />
              <div>
                <p className="chat-name">Cancara</p>
                <p className="fine">Your digital buddy · answers from Stride. Your manager sees anything you send them.</p>
              </div>
              <button className="btn ghost" onClick={() => setOpen(false)}>
                Close
              </button>
            </header>

            <div className="chat-list" ref={listRef}>
              {state.chat.length === 0 && (
                <p className="chat-hello">
                  Hi {state.firstName}. Ask me anything about your first 90 days, or pick a question below. I can also send a message to your manager or buddy on Teams for you.
                </p>
              )}
              {state.chat.map((m) => (
                <div key={m.id} className={`bubble ${m.from}`}>
                  {m.text}
                  {m.from === 'cancara' && m.escalate && (() => {
                    const idx = state.chat.indexOf(m);
                    const asked = [...state.chat.slice(0, idx)].reverse().find((x) => x.from === 'you');
                    return asked ? (
                      <button className="btn primary bubble-action" onClick={() => onSendToManager(asked.text)}>
                        Ask your manager on Teams
                      </button>
                    ) : null;
                  })()}
                  {m.action?.kind === 'checkin' && (
                    <div className="slot-list" role="group" aria-label="Free times with your manager">
                      {(m.action.slots ?? []).map((slot) => (
                        <button key={slot.label} className="btn outline slot-btn" onClick={() => onBookCheckIn(m.action!.stage, slot)}>
                          {slot.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {lastEscalation && lastQuestion && (
              <div className="escalate">
                <p className="fine">Cancara could not fully answer this. Would you like your manager to reply?</p>
                <button className="btn primary block" onClick={() => onSendToManager(lastQuestion.text)}>
                  Send to your manager on Teams
                </button>
              </div>
            )}

            <div className="chat-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="chip" onClick={() => pick(s)}>
                  {s}
                </button>
              ))}
            </div>

            {compose && (
              <p className="fine compose-note">
                Type your message below. Cancara will send it to your {compose} on Teams.
                <button className="btn ghost" onClick={() => setCompose(null)}>Cancel</button>
              </p>
            )}
            <form
              className="chat-input"
              onSubmit={(e) => {
                e.preventDefault();
                send(text);
              }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={compose ? `Message your ${compose}…` : 'Ask Cancara…'}
                aria-label="Message Cancara"
              />
              <button className="btn primary" type="submit">
                Send
              </button>
            </form>

            <div className="chat-foot">
              <button className="btn outline block" onClick={onNotifyActions}>
                Let your manager know what they need to do
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
