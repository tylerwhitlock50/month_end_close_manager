/**
 * Workflow Builder Utility Functions
 * 
 * Utilities for converting between API data and React Flow formats,
 * auto-layout algorithms, and workflow validation.
 */

import dagre from 'dagre'
import { Node, Edge, Position } from 'reactflow'

export interface WorkflowNode {
  id: number
  name: string
  description?: string
  status?: string
  department?: string
  owner?: { id: number; name: string }
  assignee?: { id: number; name: string }
  due_date?: string
  priority?: number
  position_x?: number | null
  position_y?: number | null
  dependency_ids: number[]
}

export interface WorkflowEdge {
  id: string
  source: number
  target: number
}

export interface WorkflowData {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

/**
 * Convert API workflow nodes to React Flow nodes
 */
export function convertToReactFlowNodes(apiNodes: WorkflowNode[], nodeType: string = 'taskNode'): Node[] {
  return apiNodes.map((node) => ({
    id: node.id.toString(),
    type: nodeType,
    position: {
      x: node.position_x ?? 0,
      y: node.position_y ?? 0,
    },
    data: {
      ...node,
      label: node.name,
    },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }))
}

/**
 * Convert API workflow edges to React Flow edges
 */
export function convertToReactFlowEdges(apiEdges: WorkflowEdge[]): Edge[] {
  return apiEdges.map((edge) => ({
    id: edge.id,
    source: edge.source.toString(),
    target: edge.target.toString(),
    type: 'smoothstep',
    animated: false,
    style: { stroke: '#6366f1', strokeWidth: 2 },
  }))
}

/**
 * Auto-layout nodes using the Dagre algorithm
 * Returns new nodes with calculated positions
 */
export function autoLayoutNodes(nodes: Node[], edges: Edge[]): Node[] {
  const dagreGraph = new dagre.graphlib.Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  
  const nodeWidth = 280
  const nodeHeight = 120
  
  dagreGraph.setGraph({
    rankdir: 'LR', // Left to right
    nodesep: 80,
    ranksep: 150,
    marginx: 50,
    marginy: 50,
  })

  // Add nodes to dagre
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight })
  })

  // Add edges to dagre
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target)
  })

  // Calculate layout
  dagre.layout(dagreGraph)

  // Update node positions
  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id)
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    }
  })
}

/**
 * Detect circular dependencies in a workflow
 * Returns true if a cycle exists
 */
export function hasCircularDependency(
  nodeId: number,
  targetId: number,
  nodes: WorkflowNode[],
  visited: Set<number> = new Set()
): boolean {
  if (nodeId === targetId) {
    return true
  }
  
  if (visited.has(nodeId)) {
    return false
  }
  
  visited.add(nodeId)
  
  const node = nodes.find((n) => n.id === nodeId)
  if (!node) {
    return false
  }
  
  for (const depId of node.dependency_ids) {
    if (hasCircularDependency(depId, targetId, nodes, visited)) {
      return true
    }
  }
  
  return false
}

/**
 * Validate that adding a new edge won't create a circular dependency
 */
export function canAddEdge(
  sourceId: string,
  targetId: string,
  nodes: WorkflowNode[]
): { valid: boolean; error?: string } {
  const sourceNodeId = parseInt(sourceId)
  const targetNodeId = parseInt(targetId)
  
  // Can't depend on itself
  if (sourceNodeId === targetNodeId) {
    return { valid: false, error: 'A task cannot depend on itself' }
  }
  
  // Check if this would create a circular dependency
  // The target would depend on the source, so check if source depends on target
  if (hasCircularDependency(targetNodeId, sourceNodeId, nodes)) {
    return {
      valid: false,
      error: 'This connection would create a circular dependency',
    }
  }
  
  return { valid: true }
}

/**
 * Get all nodes that are disconnected (not part of any chain)
 */
export function getDisconnectedNodes(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const connectedNodeIds = new Set<number>()
  
  edges.forEach((edge) => {
    connectedNodeIds.add(edge.source)
    connectedNodeIds.add(edge.target)
  })
  
  return nodes.filter((node) => !connectedNodeIds.has(node.id))
}

/**
 * Get all separate chains/workflows
 * Returns an array of node groups that are connected to each other
 */
export function getSeparateChains(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[][] {
  const chains: WorkflowNode[][] = []
  const visited = new Set<number>()
  
  function dfs(nodeId: number, currentChain: Set<number>) {
    if (visited.has(nodeId)) {
      return
    }
    
    visited.add(nodeId)
    currentChain.add(nodeId)
    
    // Find all connected nodes (both dependencies and dependents)
    edges.forEach((edge) => {
      if (edge.source === nodeId) {
        dfs(edge.target, currentChain)
      }
      if (edge.target === nodeId) {
        dfs(edge.source, currentChain)
      }
    })
  }
  
  nodes.forEach((node) => {
    if (!visited.has(node.id)) {
      const chainNodeIds = new Set<number>()
      dfs(node.id, chainNodeIds)
      
      const chainNodes = nodes.filter((n) => chainNodeIds.has(n.id))
      if (chainNodes.length > 0) {
        chains.push(chainNodes)
      }
    }
  })
  
  return chains
}

/**
 * Calculate statistics about the workflow
 */
export function getWorkflowStats(nodes: WorkflowNode[], edges: WorkflowEdge[]): {
  totalNodes: number
  totalEdges: number
  disconnectedNodes: number
  separateChains: number
  averageDependencies: number
} {
  const disconnected = getDisconnectedNodes(nodes, edges)
  const chains = getSeparateChains(nodes, edges)
  const avgDeps = nodes.length > 0
    ? nodes.reduce((sum, node) => sum + node.dependency_ids.length, 0) / nodes.length
    : 0
  
  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    disconnectedNodes: disconnected.length,
    separateChains: chains.length,
    averageDependencies: parseFloat(avgDeps.toFixed(2)),
  }
}

/**
 * Find the critical path (longest chain) in the workflow
 * Useful for identifying bottlenecks
 */
export function findCriticalPath(nodes: WorkflowNode[], edges: WorkflowEdge[]): number[] {
  const adjacencyList = new Map<number, number[]>()
  const inDegree = new Map<number, number>()
  
  // Initialize
  nodes.forEach((node) => {
    adjacencyList.set(node.id, [])
    inDegree.set(node.id, 0)
  })
  
  // Build graph
  edges.forEach((edge) => {
    adjacencyList.get(edge.source)?.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1)
  })
  
  // Topological sort with path tracking
  const queue: number[] = []
  const pathLength = new Map<number, number>()
  const predecessor = new Map<number, number>()
  
  nodes.forEach((node) => {
    pathLength.set(node.id, 0)
    if (inDegree.get(node.id) === 0) {
      queue.push(node.id)
    }
  })
  
  let maxLength = 0
  let endNode = -1
  
  while (queue.length > 0) {
    const current = queue.shift()!
    const currentLength = pathLength.get(current) || 0
    
    adjacencyList.get(current)?.forEach((neighbor) => {
      const newLength = currentLength + 1
      if (newLength > (pathLength.get(neighbor) || 0)) {
        pathLength.set(neighbor, newLength)
        predecessor.set(neighbor, current)
        
        if (newLength > maxLength) {
          maxLength = newLength
          endNode = neighbor
        }
      }
      
      const newInDegree = (inDegree.get(neighbor) || 0) - 1
      inDegree.set(neighbor, newInDegree)
      
      if (newInDegree === 0) {
        queue.push(neighbor)
      }
    })
  }
  
  // Reconstruct path
  const path: number[] = []
  let current = endNode
  
  while (current !== -1 && current !== undefined) {
    path.unshift(current)
    current = predecessor.get(current) ?? -1
  }
  
  return path
}

