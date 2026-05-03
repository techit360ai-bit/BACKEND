import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'

export const CREDIT_COSTS = {
  AI_MATCH: 50,
  IDEA_EVAL: 75,
  PAID_COLLAB_REQUEST: 25,
  PRIORITY_BOOST: 100,
  INCUBATION_HUB: 200,
  EXPORT_REPORT: 30,
} as const

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

interface CreditContextType {
  balance: number
  loading: boolean
  deduct: (amount: number, action: string, description: string) => Promise<boolean>
  add: (amount: number, action: string, description: string) => Promise<void>
  refresh: () => Promise<void>
  canAfford: (amount: number) => boolean
}

const CreditContext = createContext<CreditContextType>({
  balance: 0, loading: false,
  deduct: async () => false, add: async () => {},
  refresh: async () => {}, canAfford: () => false,
})

export const CreditProvider = ({ children }: { children: ReactNode }) => {
  const { profile, user } = useAuth()
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (profile?.creditBalance !== undefined) {
      setBalance(profile.creditBalance)
    }
  }, [profile?.creditBalance])

  const getToken = () => localStorage.getItem('techit_token')

  const refresh = async () => {
    if (!user) return
    const token = getToken()
    if (!token) return
    try {
      const res = await fetch(`${API}/credits/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const { balance: b } = await res.json()
        setBalance(b)
      }
    } catch {}
  }

  const deduct = async (amount: number, action: string, description: string): Promise<boolean> => {
    if (!user || balance < amount) return false
    const token = getToken()
    if (!token) return false
    setLoading(true)
    try {
      const res = await fetch(`${API}/credits/deduct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, action, description }),
      })
      if (!res.ok) return false
      const { balance: newBalance } = await res.json()
      setBalance(newBalance)
      return true
    } catch { return false }
    finally { setLoading(false) }
  }

  const add = async (amount: number, action: string, description: string) => {
    if (!user) return
    const token = getToken()
    if (!token) return
    try {
      const res = await fetch(`${API}/credits/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount, action, description }),
      })
      if (res.ok) {
        const { balance: newBalance } = await res.json()
        setBalance(newBalance)
      }
    } catch {}
  }

  return (
    <CreditContext.Provider value={{ balance, loading, deduct, add, refresh, canAfford: (a) => balance >= a }}>
      {children}
    </CreditContext.Provider>
  )
}

export const useCredits = () => useContext(CreditContext)
