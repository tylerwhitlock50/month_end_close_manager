/**
 * Workflow Builder Store
 * 
 * Manages state for the workflow builder including:
 * - Current mode (template/period)
 * - Selected period
 * - Nodes and edges
 * - Dirty state and auto-save
 */

import { create } from 'zustand'
import { Node, Edge } from 'reactflow'

export type WorkflowMode = 'template' | 'period'

interface WorkflowState {
  // Mode and context
  mode: WorkflowMode
  selectedPeriodId: number | null
  selectedCloseType: string | null
  
  // Workflow data
  nodes: Node[]
  edges: Edge[]
  
  // UI state
  isDirty: boolean
  isSaving: boolean
  lastSavedAt: Date | null
  
  // Actions
  setMode: (mode: WorkflowMode) => void
  setSelectedPeriodId: (periodId: number | null) => void
  setSelectedCloseType: (closeType: string | null) => void
  setNodes: (nodes: Node[] | ((nodes: Node[]) => Node[])) => void
  setEdges: (edges: Edge[] | ((edges: Edge[]) => Edge[])) => void
  markDirty: () => void
  markClean: () => void
  setSaving: (isSaving: boolean) => void
  updateLastSaved: () => void
  reset: () => void
}

const initialState = {
  mode: 'template' as WorkflowMode,
  selectedPeriodId: null,
  selectedCloseType: null,
  nodes: [],
  edges: [],
  isDirty: false,
  isSaving: false,
  lastSavedAt: null,
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  ...initialState,
  
  setMode: (mode) => {
    set({ mode, isDirty: false })
  },
  
  setSelectedPeriodId: (periodId) => {
    set({ selectedPeriodId: periodId, isDirty: false })
  },
  
  setSelectedCloseType: (closeType) => {
    set({ selectedCloseType: closeType, isDirty: false })
  },
  
  setNodes: (nodesOrUpdater) => {
    const currentNodes = get().nodes
    const newNodes = typeof nodesOrUpdater === 'function'
      ? nodesOrUpdater(currentNodes)
      : nodesOrUpdater
    
    set({ nodes: newNodes, isDirty: true })
  },
  
  setEdges: (edgesOrUpdater) => {
    const currentEdges = get().edges
    const newEdges = typeof edgesOrUpdater === 'function'
      ? edgesOrUpdater(currentEdges)
      : edgesOrUpdater
    
    set({ edges: newEdges, isDirty: true })
  },
  
  markDirty: () => {
    set({ isDirty: true })
  },
  
  markClean: () => {
    set({ isDirty: false })
  },
  
  setSaving: (isSaving) => {
    set({ isSaving })
  },
  
  updateLastSaved: () => {
    set({ lastSavedAt: new Date(), isDirty: false, isSaving: false })
  },
  
  reset: () => {
    set(initialState)
  },
}))

