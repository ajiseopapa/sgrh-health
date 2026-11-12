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

  return (
    <div className="fixed inset-0 z-30 flex justify-center bg-ink-900/45">
      <div role="dialog" aria-modal="true" aria-label="관리 설정" className="flex h-full w-full max-w-[480px] flex-col bg-paper">
        <header className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink-900">관리</h2>
          <button onClick={onClose} aria-label="관리 닫기"
            className="-mr-2 flex h-11 w-11 items-center justify-center rounded-lg text-ink-700 transition active:bg-ink-50">
            <Icon name="close" size={22} />
          </button>
        </header>

        <div className="px-5">
          <Segmented label="관리 메뉴" value={section} onChange={setSection} options={[
            { value: 'employees', label: '직원' },
            { value: 'departments', label: '부서' },
            { value: 'challenges', label: '챌린지' },
            { value: 'exercises', label: '종목' },
          ]} />
        </div>

        <div className="flex-1 overflow-auto px-5 pb-10 pt-5">
          {section === 'employees' && <EmployeeManager />}
          {section === 'departments' && <DepartmentManager />}
          {section === 'challenges' && <ChallengeManager />}
          {section === 'exercises' && <ExerciseTypeManager />}
        </div>
      </div>
    </div>
  )
}
