import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface PeriodState {
  selectedPeriodId: number | null
  selectedPeriodName: string | null
  setPeriod: (id: number | null, name?: string | null) => void
}

export const usePeriodStore = create<PeriodState>()(
  persist(
    (set) => ({
      selectedPeriodId: null,
      selectedPeriodName: null,
      setPeriod: (id, name) => set({
        selectedPeriodId: id,
        selectedPeriodName: name ?? null,
      }),
    }),
    {
      name: 'period-selection',
    }
  )
)

