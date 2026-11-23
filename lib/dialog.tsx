'use client'

// 브라우저 기본 confirm/alert 대신 쓰는 앱 디자인 확인창.
//   const dialog = useDialog()
//   if (!(await dialog.confirm({ title: '삭제할까요?', tone: 'danger' }))) return
//   await dialog.alert({ title: '저장에 실패했어요', message: '…' })
import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react'

interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  /** danger: 삭제처럼 되돌릴 수 없는 동작 (빨간 버튼) */
  tone?: 'default' | 'danger'
  icon?: string
}

interface AlertOptions {
  title: string
  message?: string
  confirmText?: string
  icon?: string
}

interface DialogApi {
  confirm: (o: ConfirmOptions) => Promise<boolean>
  alert: (o: AlertOptions) => Promise<void>
}

type Pending =
  | { kind: 'confirm'; opts: ConfirmOptions; resolve: (v: boolean) => void }
  | { kind: 'alert'; opts: AlertOptions; resolve: () => void }

const Ctx = createContext<DialogApi | null>(null)

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)

  const confirm = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ kind: 'confirm', opts, resolve })),
    []
  )
  const alert = useCallback(
    (opts: AlertOptions) => new Promise<void>((resolve) => setPending({ kind: 'alert', opts, resolve })),
    []
  )

  function close(result: boolean) {
    if (!pending) return
    if (pending.kind === 'confirm') pending.resolve(result)
    else pending.resolve()
    setPending(null)
  }

  return (
    <Ctx.Provider value={{ confirm, alert }}>
      {children}
      {pending && <DialogView pending={pending} onClose={close} />}
    </Ctx.Provider>
  )
}

function DialogView({ pending, onClose }: { pending: Pending; onClose: (result: boolean) => void }) {
  const okRef = useRef<HTMLButtonElement>(null)
  const isConfirm = pending.kind === 'confirm'
  const danger = isConfirm && pending.opts.tone === 'danger'

  useEffect(() => {
    okRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center bg-ink-900/45 px-4 pb-6 sm:items-center sm:pb-0"
      onClick={() => onClose(false)}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm animate-[dialogIn_0.16s_ease-out] rounded-xl bg-paper p-6 shadow-raised"
      >
        <h3 id="dialog-title" className="text-[19px] font-extrabold leading-snug tracking-[-0.02em] text-ink-900">
          {pending.opts.title}
        </h3>
        {pending.opts.message && (
          <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-600">{pending.opts.message}</p>
        )}

        <div className="mt-6 flex gap-2">
          {isConfirm && (
            <button onClick={() => onClose(false)} className="btn-secondary min-h-[48px] flex-1">
              {pending.opts.cancelText ?? '취소'}
            </button>
          )}
          <button
            ref={okRef}
            onClick={() => onClose(true)}
            className={`min-h-[48px] flex-1 rounded-lg text-[15px] font-bold text-paper transition ${
              danger ? 'bg-red-700 active:bg-red-800' : 'bg-ink-900 active:bg-ink-700'
            }`}
          >
            {pending.opts.confirmText ?? (danger ? '삭제' : '확인')}
          </button>
        </div>
      </div>
      <style>{`@keyframes dialogIn{from{opacity:0;transform:translateY(8px) scale(.98)}to{opacity:1;transform:none}}`}</style>
    </div>
  )
}

export function useDialog(): DialogApi {
  const v = useContext(Ctx)
  if (!v) throw new Error('DialogProvider 안에서만 쓸 수 있어요')
  return v
}
