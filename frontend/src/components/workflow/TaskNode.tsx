/**
 * TaskNode Component
 * 
 * Custom node component for React Flow that displays a task or template
 * in the workflow builder with status, assignee, and other relevant information.
 */

import { memo } from 'react'
import { Handle, Position } from 'reactflow'
import { Calendar, User, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { formatDate, getStatusColor, getStatusLabel } from '../../lib/utils'

interface TaskNodeData {
  id: number
  name: string
  description?: string
  status?: string
  department?: string
  owner?: { id: number; name: string }
  assignee?: { id: number; name: string }
  due_date?: string
  priority?: number
  dependency_ids: number[]
}

interface TaskNodeProps {
  data: TaskNodeData
  selected?: boolean
}

function TaskNode({ data, selected }: TaskNodeProps) {
  const hasStatus = !!data.status
  const isOverdue = data.due_date && new Date(data.due_date) < new Date()
  const priorityColor = data.priority && data.priority >= 8 ? 'text-red-600' : 'text-gray-600'

  return (
    <div
      className={`
        bg-white rounded-lg shadow-md border-2 transition-all
        ${selected ? 'border-primary-500 shadow-lg' : 'border-gray-300'}
        ${isOverdue ? 'ring-2 ring-red-400' : ''}
        hover:shadow-lg
        w-[280px]
      `}
    >
      {/* Connection handles */}
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-primary-500 !w-3 !h-3 !border-2 !border-white"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-primary-500 !w-3 !h-3 !border-2 !border-white"
      />

      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm text-gray-900 line-clamp-2 flex-1">
            {data.name}
          </h3>
          {data.priority && (
            <span className={`text-xs font-medium ${priorityColor} flex-shrink-0`}>
              P{data.priority}
            </span>
          )}
        </div>
        {data.department && (
          <p className="text-xs text-gray-500 mt-1">{data.department}</p>
        )}
      </div>

      {/* Body */}
      <div className="p-3 space-y-2">
        {/* Status Badge (only for period tasks) */}
        {hasStatus && (
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium badge-${getStatusColor(data.status!)}`}>
              {getStatusLabel(data.status!)}
            </span>
            {isOverdue && (
              <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                <AlertCircle className="w-3 h-3" />
                Overdue
              </span>
            )}
          </div>
        )}

        {/* Assignee/Owner */}
        {data.assignee && (
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <User className="w-3 h-3 flex-shrink-0" />
            <span className="truncate">{data.assignee.name}</span>
          </div>
        )}

        {/* Due Date */}
        {data.due_date && (
          <div className={`flex items-center gap-2 text-xs ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
            <Calendar className="w-3 h-3 flex-shrink-0" />
            <span>{formatDate(data.due_date)}</span>
          </div>
        )}

        {/* Dependencies indicator */}
        {data.dependency_ids.length > 0 && (
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Clock className="w-3 h-3 flex-shrink-0" />
            <span>Depends on {data.dependency_ids.length} task{data.dependency_ids.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>

      {/* Footer indicator for template vs task */}
      <div className={`px-3 py-1.5 text-[10px] uppercase font-medium tracking-wide rounded-b-lg ${
        hasStatus ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'
      }`}>
        {hasStatus ? 'Task' : 'Template'}
      </div>
    </div>
  )
}

export default memo(TaskNode)

