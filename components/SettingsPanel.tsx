'use client'

import { useState } from 'react'
import EmployeeManager from './EmployeeManager'
import ExerciseTypeManager from './ExerciseTypeManager'

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<'employees' | 'exercises'>('employees')

  return (
    <div className="fixed inset-0 z-30 bg-black/30 flex justify-center">
      <div className="w-full max-w-md bg-white h-full flex flex-col">
        <header className="flex items-center justify-between px-4 py-3 border-b">
          <h2 className="text-base font-bold">⚙️ 관리 설정</h2>
          <button onClick={onClose} aria-label="닫기" className="text-gray-400 text-xl leading-none px-1">
            ✕
          </button>
        </header>

        <div className="flex border-b">
          <button
            onClick={() => setSection('employees')}
            className={`flex-1 py-2.5 text-sm transition-colors ${
              section === 'employees'
                ? 'text-brand-600 font-semibold border-b-2 border-brand-600'
                : 'text-gray-400'
            }`}
          >
            직원 관리
          </button>
          <button
            onClick={() => setSection('exercises')}
            className={`flex-1 py-2.5 text-sm transition-colors ${
              section === 'exercises'
                ? 'text-brand-600 font-semibold border-b-2 border-brand-600'
                : 'text-gray-400'
            }`}
          >
            운동 종목 관리
          </button>
        </div>

        <div className="flex-1 overflow-auto px-4 py-4">
          {section === 'employees' ? <EmployeeManager /> : <ExerciseTypeManager />}
        </div>
      </div>
    </div>
  )
}
