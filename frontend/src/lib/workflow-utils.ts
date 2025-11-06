import { Node, Edge, MarkerType } from 'reactflow'
import dagre from 'dagre'

/**
 * Workflow Node interface from API
 */
export interface WorkflowNode {
  id: number
  name: string
  description?: string | null
  status?: string | null
  department?: string | null
  owner?: { id: number; name: string; email: string } | null
  assignee?: { id: number; name: string; email: string } | null
  due_date?: string | null
  priority?: number | null
  position_x?: number | null
  position_y?: number | null
  dependency_ids: number[]
}

/**
 * Workflow Edge interface from API
 */
export interface WorkflowEdge {
  id: string
  source: number
  target: number
}

/**
 * Workflow Response interface from API
 */
export interface WorkflowResponse {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

/**
 * Convert API workflow nodes to ReactFlow nodes
 */
export const convertToReactFlowNodes = (
  apiNodes: WorkflowNode[],
  nodeType: string = 'default'
): Node[] => {
  return apiNodes.map((node) => ({
    id: node.id.toString(),
    type: nodeType,
    position: {
      x: node.position_x ?? 0,
      y: node.position_y ?? 0,
    },
    data: {
      id: node.id,
      name: node.name,
      description: node.description,
      status: node.status,
      department: node.department,
      owner: node.owner,
      assignee: node.assignee,
      dueDate: node.due_date,
      priority: node.priority,
      dependencyIds: node.dependency_ids,
    },
  }))
}

/**
 * Convert API workflow edges to ReactFlow edges
 */
export const convertToReactFlowEdges = (apiEdges: WorkflowEdge[]): Edge[] => {
  return apiEdges.map((edge) => ({
    id: edge.id,
    source: edge.source.toString(),
    target: edge.target.toString(),
    type: 'smoothstep',
    animated: false,
    style: { stroke: '#6366f1', strokeWidth: 2 },
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: '#6366f1',
    },
  }))
}

/**
 * Auto-layout nodes using dagre algorithm
 */
export const autoLayoutNodes = (nodes: Node[], edges: Edge[]): Node[] => {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))

  const nodeWidth = 250
  const nodeHeight = 120

  // Configure layout direction and spacing
  dagreGraph.setGraph({
    rankdir: 'TB', // Top to bottom
    align: 'UL', // Upper left alignment
    nodesep: 50, // Horizontal spacing between nodes
    ranksep: 100, // Vertical spacing between ranks
    marginx: 50,
    marginy: 50,
  })

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  })

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  // Calculate layout
  dagre.layout(dagreGraph)

  // Update node positions
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    return {
      ...node,
      position: {
        // Center the node based on dagre's output
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    }
  })

  return layoutedNodes
}

/**
 * Check if adding an edge would create a cycle
 */
const wouldCreateCycle = (
  sourceId: string,
  targetId: string,
  nodes: WorkflowNode[]
): boolean => {
  const visited = new Set<number>()
  const recursionStack = new Set<number>()

  const dfs = (nodeId: number): boolean => {
    if (recursionStack.has(nodeId)) return true
    if (visited.has(nodeId)) return false

    visited.add(nodeId)
    recursionStack.add(nodeId)

    const node = nodes.find((n) => n.id === nodeId)
    if (node) {
      for (const depId of node.dependency_ids) {
        if (dfs(depId)) return true
      }
    }

    recursionStack.delete(nodeId)
    return false
  }

  // Simulate adding the edge
  const targetNode = nodes.find((n) => n.id === parseInt(targetId))
  if (!targetNode) return false

  const simulatedNode = {
    ...targetNode,
    dependency_ids: [...targetNode.dependency_ids, parseInt(sourceId)],
  }

  const simulatedNodes = nodes.map((n) =>
    n.id === parseInt(targetId) ? simulatedNode : n
  )

  // Check if adding this edge would create a cycle starting from the target
  return dfs(parseInt(targetId))
}

/**
 * Validate if an edge can be added between two nodes
 */
export const canAddEdge = (
  sourceId: string,
  targetId: string,
  nodes: WorkflowNode[]
): { valid: boolean; error?: string } => {
  // Can't connect node to itself
  if (sourceId === targetId) {
    return { valid: false, error: 'Cannot connect a node to itself' }
  }

  // Check if nodes exist
  const sourceNode = nodes.find((n) => n.id === parseInt(sourceId))
  const targetNode = nodes.find((n) => n.id === parseInt(targetId))

  if (!sourceNode || !targetNode) {
    return { valid: false, error: 'Source or target node not found' }
  }

  // Check if edge already exists
  if (targetNode.dependency_ids.includes(parseInt(sourceId))) {
    return { valid: false, error: 'This dependency already exists' }
  }

  // Check for cycles
  if (wouldCreateCycle(sourceId, targetId, nodes)) {
    return {
      valid: false,
      error: 'Cannot add dependency: would create a circular dependency',
    }
  }

  return { valid: true }
}

/**
 * Calculate workflow statistics
 */
export const getWorkflowStats = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): {
  totalNodes: number
  totalEdges: number
  nodesWithoutDependencies: number
  nodesWithoutDependents: number
  maxDependencyDepth: number
} => {
  const totalNodes = nodes.length
  const totalEdges = edges.length

  // Nodes without dependencies (start nodes)
  const nodesWithoutDependencies = nodes.filter(
    (node) => node.dependency_ids.length === 0
  ).length

  // Nodes without dependents (end nodes)
  const targetIds = new Set(edges.map((edge) => edge.target))
  const nodesWithoutDependents = nodes.filter(
    (node) => !targetIds.has(node.id)
  ).length

  // Calculate max dependency depth using BFS
  const calculateDepth = (nodeId: number, visited: Set<number> = new Set()): number => {
    if (visited.has(nodeId)) return 0

    visited.add(nodeId)
    const node = nodes.find((n) => n.id === nodeId)
    if (!node || node.dependency_ids.length === 0) return 1

    const depths = node.dependency_ids.map((depId) =>
      calculateDepth(depId, new Set(visited))
    )

    return 1 + Math.max(...depths, 0)
  }

  const maxDependencyDepth = Math.max(
    ...nodes.map((node) => calculateDepth(node.id)),
    0
  )

  return {
    totalNodes,
    totalEdges,
    nodesWithoutDependencies,
    nodesWithoutDependents,
    maxDependencyDepth,
  }
}

/**
 * Get the critical path (longest path) through the workflow
 */
export const getCriticalPath = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[]
): number[] => {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const memo = new Map<number, { length: number; path: number[] }>()

  const getLongestPath = (nodeId: number): { length: number; path: number[] } => {
    if (memo.has(nodeId)) {
      return memo.get(nodeId)!
    }

    const node = nodeMap.get(nodeId)
    if (!node || node.dependency_ids.length === 0) {
      const result = { length: 1, path: [nodeId] }
      memo.set(nodeId, result)
      return result
    }

    let longest = { length: 0, path: [] as number[] }
    for (const depId of node.dependency_ids) {
      const depPath = getLongestPath(depId)
      if (depPath.length > longest.length) {
        longest = depPath
      }
    }

    const result = {
      length: longest.length + 1,
      path: [...longest.path, nodeId],
    }
    memo.set(nodeId, result)
    return result
  }

  // Find all end nodes (nodes with no dependents)
  const targetIds = new Set(edges.map((edge) => edge.target))
  const endNodes = nodes.filter((node) => !targetIds.has(node.id))

  // Find the longest path among all end nodes
  let criticalPath: number[] = []
  let maxLength = 0

  for (const endNode of endNodes) {
    const path = getLongestPath(endNode.id)
    if (path.length > maxLength) {
      maxLength = path.length
      criticalPath = path.path
    }
  }

  return criticalPath
}

/**
 * Group nodes by their level in the dependency hierarchy
 */
export const getNodeLevels = (
  nodes: WorkflowNode[]
): Map<number, WorkflowNode[]> => {
  const levels = new Map<number, WorkflowNode[]>()
  const nodeLevel = new Map<number, number>()

  const calculateLevel = (nodeId: number, visited: Set<number> = new Set()): number => {
    if (nodeLevel.has(nodeId)) {
      return nodeLevel.get(nodeId)!
    }

    if (visited.has(nodeId)) {
      // Cycle detected, return 0
      return 0
    }

    visited.add(nodeId)
    const node = nodes.find((n) => n.id === nodeId)
    if (!node || node.dependency_ids.length === 0) {
      nodeLevel.set(nodeId, 0)
      return 0
    }

    const depLevels = node.dependency_ids.map((depId) =>
      calculateLevel(depId, new Set(visited))
    )
    const level = Math.max(...depLevels, -1) + 1

    nodeLevel.set(nodeId, level)
    return level
  }

  // Calculate levels for all nodes
  nodes.forEach((node) => {
    const level = calculateLevel(node.id)
    if (!levels.has(level)) {
      levels.set(level, [])
    }
    levels.get(level)!.push(node)
  })

  return levels
}
