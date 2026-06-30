'use client'

import { useState } from 'react'
import EmployeeManager from './EmployeeManager'
import ExerciseTypeManager from './ExerciseTypeManager'

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<'employees' | 'exercises'>('employees')

  return (
    <div className="fixed inset-0 z-30 flex justify-center bg-black/30">
      <div className="flex h-full w-full max-w-md flex-col bg-surface">
        <header className="flex items-center justify-between border-b border-ink-100 bg-white px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-base">
              ⚙️
            </span>
            <h2 className="text-base font-bold tracking-tight text-ink-900">관리 설정</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-ink-400 transition active:bg-ink-100"
          >
            ✕
          </button>
        </header>

        <div className="flex gap-1 rounded-xl bg-ink-100 p-1 m-4">
          <button
            onClick={() => setSection('employees')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              section === 'employees' ? 'bg-white text-brand-700 shadow-card' : 'text-ink-400'
            }`}
          >
            직원 관리
          </button>
          <button
            onClick={() => setSection('exercises')}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              section === 'exercises' ? 'bg-white text-brand-700 shadow-card' : 'text-ink-400'
            }`}
          >
            운동 종목 관리
          </button>
        </div>

        <div className="flex-1 overflow-auto px-4 pb-6">
          {section === 'employees' ? <EmployeeManager /> : <ExerciseTypeManager />}
        </div>
      </div>
    </div>
  )
}
