'use client'

// 발급한 임시 PIN을 "이번 한 번만" 보여주는 화면.
// 저장소(localStorage 등)나 서버 로그에 남기지 않고, 닫으면 메모리에서도 사라집니다.
import { useState } from 'react'
import { useDialog } from '@/lib/dialog'

export interface IssuedPin {
  employeeId: string
  name: string
  employeeNumber: string
  pin: string
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

export default function PinIssueResult({ issued, onClose }: { issued: IssuedPin[]; onClose: () => void }) {
  const [confirmClose, setConfirmClose] = useState(false)
  const dialog = useDialog()

  function print() {
    const w = window.open('', '_blank', 'width=720,height=900')
    if (!w) {
      dialog.alert({ icon: '🚫', title: '팝업이 막혀 있어요', message: '주소창 오른쪽에서 팝업을 허용한 뒤\n다시 눌러주세요.' })
      return
    }
    const rows = issued
      .map((p) => `<tr><td>${escapeHtml(p.name)}</td><td>${escapeHtml(p.employeeNumber)}</td><td class="pin">${p.pin}</td><td class="cut">✂ ${escapeHtml(p.name)}님 임시 PIN: <b>${p.pin}</b> · 첫 로그인 후 내 PIN으로 바꿔주세요</td></tr>`)
      .join('')
    w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>임시 PIN 배부표</title>
      <style>body{font-family:sans-serif;padding:24px}table{width:100%;border-collapse:collapse;font-size:13px}
      td,th{border:1px solid #ccc;padding:8px}.pin{font-family:monospace;font-size:16px;letter-spacing:2px}
      .cut{font-size:11px;color:#444}h1{font-size:16px}p{font-size:12px;color:#666}</style></head><body>
      <h1>운동 관리 임시 PIN 배부표 (${issued.length}명)</h1>
      <p>배부 후 이 종이는 파쇄해주세요. 다시 출력할 수 없습니다.</p>
      <table><thead><tr><th>이름</th><th>사번</th><th>임시 PIN</th><th>개인별 전달용</th></tr></thead><tbody>${rows}</tbody></table>
      <script>window.onload=function(){window.print()}</script></body></html>`)
    w.document.close()
  }

  return (
    <div className="space-y-3">
      <div className="card space-y-1.5 border border-ink-900 bg-transparent">
        <p className="text-sm font-bold text-ink-900">이 화면은 한 번만 보여요</p>
        <p className="text-xs text-ink-900">
          닫으면 다시 볼 수 없어요. 출력하거나 직원에게 전달한 뒤 닫아주세요.
          잃어버리면 그 직원만 다시 초기화하면 됩니다.
        </p>
      </div>

      <button onClick={print} className="btn-primary">배부표 출력</button>

      <ul className="card divide-y divide-ink-100 p-0">
        {issued.map((p) => (
          <li key={p.employeeId} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-sm text-ink-800">
              {p.name} <span className="text-xs text-ink-300">#{p.employeeNumber}</span>
            </span>
            <span className="font-mono text-base font-bold tracking-widest text-ink-900">{p.pin}</span>
          </li>
        ))}
      </ul>

      {confirmClose ? (
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-primary flex-1 bg-red-700">네, 닫을게요</button>
          <button onClick={() => setConfirmClose(false)} className="btn-secondary">아니요</button>
        </div>
      ) : (
        <button onClick={() => setConfirmClose(true)} className="btn-secondary w-full">전달 끝, 닫기</button>
      )}
    </div>
  )
}
