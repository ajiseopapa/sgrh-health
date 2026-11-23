'use client'

// "지금 이 기기에서 확인된 나"와 관리자 여부. 진짜 판단은 항상 서버가 하고,
// 여기 값은 화면에 무엇을 보여줄지 정하는 데만 씁니다.
import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react'
import { api } from './api'

export interface Me {
  id: string
  name: string
  employee_number: string
  color: string | null
}

interface MeState {
  loaded: boolean
  me: Me | null
  mustChangePin: boolean
  isAdmin: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
  adminLogout: () => Promise<void>
  /** 본인 확인 창 열기. 완료되면 onDone 실행 */
  requireMe: (onDone?: () => void) => void
  identityOpen: boolean
  closeIdentity: (done: boolean) => void
}

const Ctx = createContext<MeState | null>(null)

export function MeProvider({ children }: { children: ReactNode }) {
  const [loaded, setLoaded] = useState(false)
  const [me, setMe] = useState<Me | null>(null)
  const [mustChangePin, setMustChangePin] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [identityOpen, setIdentityOpen] = useState(false)
  const [pending, setPending] = useState<(() => void) | null>(null)

  const refresh = useCallback(async () => {
    const r = await api<{ me: Me | null; mustChangePin: boolean; isAdmin: boolean }>('/api/auth/me')
    if (r.ok) {
      setMe(r.data.me)
      setMustChangePin(!!r.data.mustChangePin)
      setIsAdmin(!!r.data.isAdmin)
    }
    setLoaded(true)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' })
    await refresh()
  }, [refresh])

  const adminLogout = useCallback(async () => {
    await api('/api/admin/logout', { method: 'POST' })
    await refresh()
  }, [refresh])

  const requireMe = useCallback((onDone?: () => void) => {
    setPending(() => onDone ?? null)
    setIdentityOpen(true)
  }, [])

  const closeIdentity = useCallback((done: boolean) => {
    setIdentityOpen(false)
    if (done && pending) pending()
    setPending(null)
  }, [pending])

  return (
    <Ctx.Provider value={{ loaded, me, mustChangePin, isAdmin, refresh, logout, adminLogout, requireMe, identityOpen, closeIdentity }}>
      {children}
    </Ctx.Provider>
  )
}

export function useMe(): MeState {
  const v = useContext(Ctx)
  if (!v) throw new Error('MeProvider 안에서만 쓸 수 있어요')
  return v
}
