'use client'

// 관리 설정 — 직원 메뉴와 분리된 관리자 전용 화면
import { useState } from 'react'
import EmployeeManager from './EmployeeManager'
import ExerciseTypeManager from './ExerciseTypeManager'
import DepartmentManager from './DepartmentManager'
import ChallengeManager from './ChallengeManager'
import { Icon, Segmented } from '@/lib/ui'

type Section = 'employees' | 'departments' | 'challenges' | 'exercises'

export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [section, setSection] = useState<Section>('employees')

  const MENU: { value: Section; label: string }[] = [
    { value: 'employees', label: '직원' },
    { value: 'departments', label: '부서' },
    { value: 'challenges', label: '챌린지' },
    { value: 'exercises', label: '종목' },
  ]

  return (
    <div className="fixed inset-0 z-30 flex justify-center bg-ink-900/45 lg:items-center lg:p-8">
      {/* 폰: 화면 전체 / PC(1024px 이상): 가운데 넓은 창 + 왼쪽 메뉴 */}
      <div role="dialog" aria-modal="true" aria-label="관리 설정"
        className="flex h-full w-full max-w-[480px] flex-col bg-paper lg:h-[88vh] lg:max-w-[1040px] lg:overflow-hidden lg:rounded-2xl lg:shadow-raised">
        <header className="flex items-center justify-between px-5 pb-2 pt-3 lg:border-b lg:border-line lg:px-8 lg:py-4">
          <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink-900">관리</h2>
          <button onClick={onClose} aria-label="관리 닫기"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-ink-700 transition active:bg-ink-50 lg:hover:bg-ink-50">
            <Icon name="close" size={22} />
          </button>
        </header>

        <div className="px-5 lg:hidden">
          <Segmented label="관리 메뉴" value={section} onChange={setSection} options={MENU} />
        </div>

        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
          <nav aria-label="관리 메뉴" className="hidden w-52 shrink-0 flex-col gap-1 border-r border-line p-4 lg:flex">
            {MENU.map((m) => (
              <button key={m.value} type="button" onClick={() => setSection(m.value)} aria-current={section === m.value ? 'page' : undefined}
                className={`min-h-[48px] rounded-xl px-4 text-left text-[15px] font-bold transition-colors ${
                  section === m.value ? 'bg-brand-300 text-ink-900' : 'text-ink-500 hover:bg-ink-50'
                }`}>
                {m.label}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-auto px-5 pb-10 pt-5 lg:px-8 lg:pt-6">
            <div className="lg:max-w-[720px]">
              {section === 'employees' && <EmployeeManager />}
              {section === 'departments' && <DepartmentManager />}
              {section === 'challenges' && <ChallengeManager />}
              {section === 'exercises' && <ExerciseTypeManager />}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
