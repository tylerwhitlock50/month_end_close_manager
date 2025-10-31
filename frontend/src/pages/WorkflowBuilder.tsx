/**
 * Workflow Builder Page
 * 
 * Visual drag-and-drop workflow builder for task dependencies.
 * Supports both template workflows and period-specific task workflows.
 */

import { useEffect, useCallback, useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeTypes,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import {
  Workflow,
  LayoutGrid,
  Save,
  AlertCircle,
  CheckCircle,
  Filter,
  Loader2,
} from 'lucide-react'

import { useWorkflowStore } from '../stores/workflowStore'
import { usePeriodStore } from '../stores/periodStore'
import TaskNode from '../components/workflow/TaskNode'
import {
  fetchTemplateWorkflow,
  fetchPeriodWorkflow,
  updateTaskPosition,
  updateTemplatePosition,
  updateTaskDependencies,
  updateTemplateDependencies,
} from '../lib/api'
import {
  convertToReactFlowNodes,
  convertToReactFlowEdges,
  autoLayoutNodes,
  canAddEdge,
  getWorkflowStats,
  WorkflowNode as ApiWorkflowNode,
} from '../lib/workflow-utils'
import api from '../lib/api'

const nodeTypes: NodeTypes = {
  taskNode: TaskNode,
}

const CLOSE_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'year_end', label: 'Year End' },
]

export default function WorkflowBuilder() {
  const queryClient = useQueryClient()
  const { selectedPeriodId: globalPeriodId } = usePeriodStore()
  
  const {
    mode,
    selectedPeriodId,
    selectedCloseType,
    isDirty,
    isSaving,
    lastSavedAt,
    setMode,
    setSelectedPeriodId,
    setSelectedCloseType,
    markDirty,
    markClean,
    setSaving,
    updateLastSaved,
  } = useWorkflowStore()

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])
  const [apiNodes, setApiNodes] = useState<ApiWorkflowNode[]>([])
  const [saveError, setSaveError] = useState<string | null>(null)

  // Fetch workflow data
  const { data: workflowData, isLoading, refetch } = useQuery({
    queryKey: ['workflow', mode, mode === 'template' ? selectedCloseType : selectedPeriodId],
    queryFn: async () => {
      if (mode === 'template') {
        return await fetchTemplateWorkflow(selectedCloseType || undefined)
      } else {
        if (!selectedPeriodId) throw new Error('No period selected')
        return await fetchPeriodWorkflow(selectedPeriodId)
      }
    },
    enabled: mode === 'template' || !!selectedPeriodId,
  })

  // Fetch periods for period mode
  const { data: periods } = useQuery({
    queryKey: ['periods'],
    queryFn: async () => {
      const response = await api.get('/api/periods/')
      return response.data
    },
    enabled: mode === 'period',
  })

  // Update nodes and edges when workflow data changes
  useEffect(() => {
    if (workflowData) {
      const reactFlowNodes = convertToReactFlowNodes(workflowData.nodes, 'taskNode')
      const reactFlowEdges = convertToReactFlowEdges(workflowData.edges)
      
      setNodes(reactFlowNodes)
      setEdges(reactFlowEdges)
      setApiNodes(workflowData.nodes)
      markClean()
    }
  }, [workflowData, setNodes, setEdges, markClean])

  // Auto-save on position changes (debounced)
  const savePositionMutation = useMutation({
    mutationFn: async ({ nodeId, x, y }: { nodeId: string; x: number; y: number }) => {
      const id = parseInt(nodeId)
      if (mode === 'template') {
        return await updateTemplatePosition(id, x, y)
      } else {
        return await updateTaskPosition(id, x, y)
      }
    },
  })

  // Save dependency changes
  const saveDependenciesMutation = useMutation({
    mutationFn: async ({ nodeId, dependencyIds }: { nodeId: number; dependencyIds: number[] }) => {
      if (mode === 'template') {
        return await updateTemplateDependencies(nodeId, dependencyIds)
      } else {
        return await updateTaskDependencies(nodeId, dependencyIds)
      }
    },
    onSuccess: () => {
      refetch()
      updateLastSaved()
      setSaveError(null)
    },
    onError: (error: any) => {
      setSaveError(error.response?.data?.detail || 'Failed to save dependencies')
    },
  })

  // Handle node drag end - auto-save position
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      savePositionMutation.mutate({
        nodeId: node.id,
        x: node.position.x,
        y: node.position.y,
      })
    },
    [savePositionMutation]
  )

  // Handle edge connection - validate and save
  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return

      // Validate connection
      const validation = canAddEdge(connection.source, connection.target, apiNodes)
      if (!validation.valid) {
        setSaveError(validation.error || 'Invalid connection')
        return
      }

      // Add edge visually
      const newEdge: Edge = {
        ...connection,
        id: `${connection.source}-${connection.target}`,
        type: 'smoothstep',
        animated: false,
        style: { stroke: '#6366f1', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
      }
      setEdges((eds) => addEdge(newEdge, eds))

      // Update dependencies in API
      const targetNodeId = parseInt(connection.target)
      const targetNode = apiNodes.find((n) => n.id === targetNodeId)
      if (targetNode) {
        const newDependencies = [
          ...targetNode.dependency_ids,
          parseInt(connection.source),
        ]
        saveDependenciesMutation.mutate({
          nodeId: targetNodeId,
          dependencyIds: newDependencies,
        })
      }
    },
    [apiNodes, setEdges, saveDependenciesMutation]
  )

  // Handle edge deletion
  const onEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      deletedEdges.forEach((edge) => {
        const targetNodeId = parseInt(edge.target)
        const sourceNodeId = parseInt(edge.source)
        const targetNode = apiNodes.find((n) => n.id === targetNodeId)
        
        if (targetNode) {
          const newDependencies = targetNode.dependency_ids.filter(
            (id) => id !== sourceNodeId
          )
          saveDependenciesMutation.mutate({
            nodeId: targetNodeId,
            dependencyIds: newDependencies,
          })
        }
      })
    },
    [apiNodes, saveDependenciesMutation]
  )

  // Auto-layout button handler
  const handleAutoLayout = useCallback(() => {
    const layoutedNodes = autoLayoutNodes(nodes, edges)
    setNodes(layoutedNodes)
    
    // Save all new positions
    layoutedNodes.forEach((node) => {
      savePositionMutation.mutate({
        nodeId: node.id,
        x: node.position.x,
        y: node.position.y,
      })
    })
  }, [nodes, edges, setNodes, savePositionMutation])

  // Calculate workflow stats
  const stats = useMemo(() => {
    return getWorkflowStats(apiNodes, workflowData?.edges || [])
  }, [apiNodes, workflowData])

  // Sync selected period with global period store
  useEffect(() => {
    if (mode === 'period' && !selectedPeriodId && globalPeriodId) {
      setSelectedPeriodId(globalPeriodId)
    }
  }, [mode, selectedPeriodId, globalPeriodId, setSelectedPeriodId])

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Workflow className="w-8 h-8 text-primary-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Workflow Builder</h1>
                <p className="text-sm text-gray-600">Visual task dependency management</p>
              </div>
            </div>

            {/* Mode Selector */}
            <div className="flex items-center gap-2 ml-8">
              <button
                onClick={() => setMode('template')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  mode === 'template'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Templates
              </button>
              <button
                onClick={() => setMode('period')}
                className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                  mode === 'period'
                    ? 'bg-primary-100 text-primary-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Period Tasks
              </button>
            </div>
          </div>

          {/* Filters and Actions */}
          <div className="flex items-center gap-3">
            {/* Mode-specific filters */}
            {mode === 'template' && (
              <select
                value={selectedCloseType || ''}
                onChange={(e) => setSelectedCloseType(e.target.value || null)}
                className="input text-sm"
              >
                {CLOSE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            )}

            {mode === 'period' && (
              <select
                value={selectedPeriodId || ''}
                onChange={(e) => setSelectedPeriodId(e.target.value ? parseInt(e.target.value) : null)}
                className="input text-sm"
              >
                <option value="">Select Period...</option>
                {periods?.map((period: any) => (
                  <option key={period.id} value={period.id}>
                    {period.name}
                  </option>
                ))}
              </select>
            )}

            {/* Auto-layout button */}
            <button
              onClick={handleAutoLayout}
              disabled={nodes.length === 0}
              className="btn-secondary text-sm"
            >
              <LayoutGrid className="w-4 h-4 mr-2" />
              Auto Layout
            </button>

            {/* Save status */}
            <div className="flex items-center gap-2 text-sm">
              {isSaving && (
                <span className="flex items-center gap-2 text-gray-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              )}
              {!isSaving && !isDirty && lastSavedAt && (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4" />
                  Saved
                </span>
              )}
              {saveError && (
                <span className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  Error
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        {workflowData && (
          <div className="flex items-center gap-6 mt-4 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <span className="font-medium">{stats.totalNodes}</span>
              <span>nodes</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{stats.totalEdges}</span>
              <span>connections</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-medium">{stats.separateChains}</span>
              <span>chains</span>
            </div>
            {stats.disconnectedNodes > 0 && (
              <div className="flex items-center gap-2 text-amber-600">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">{stats.disconnectedNodes}</span>
                <span>disconnected</span>
              </div>
            )}
          </div>
        )}

        {/* Error message */}
        {saveError && (
          <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-700">{saveError}</div>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-gray-50">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-gray-400" />
              <p className="text-gray-600">Loading workflow...</p>
            </div>
          </div>
        ) : !workflowData || (mode === 'period' && !selectedPeriodId) ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <Filter className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {mode === 'period' ? 'Select a Period' : 'No Workflow Data'}
              </h3>
              <p className="text-gray-600">
                {mode === 'period'
                  ? 'Choose a period from the dropdown above to view and edit its task workflow.'
                  : 'No templates found for the selected close type.'}
              </p>
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStop={onNodeDragStop}
            onEdgesDelete={onEdgesDelete}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.2 }}
            minZoom={0.1}
            maxZoom={1.5}
            defaultEdgeOptions={{
              type: 'smoothstep',
              animated: false,
              style: { stroke: '#6366f1', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
            }}
          >
            <Background color="#e5e7eb" gap={16} />
            <Controls />
            <MiniMap
              nodeColor={(node) => {
                if (node.data.status === 'complete') return '#10b981'
                if (node.data.status === 'in_progress') return '#3b82f6'
                if (node.data.status === 'blocked') return '#ef4444'
                return '#8b5cf6'
              }}
              maskColor="rgba(0, 0, 0, 0.1)"
            />
          </ReactFlow>
        )}
      </div>
    </div>
  )
}

