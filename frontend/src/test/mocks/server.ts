/**
 * MSW Server Setup for Node Environment (Tests)
 */

import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)

