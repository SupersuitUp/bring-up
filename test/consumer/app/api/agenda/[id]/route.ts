import { createBringUpHandlers } from '@supersuit/bring-up/server'
import { host } from '../../../../lib/host'

export const runtime = 'nodejs'
export const { PATCH, DELETE } = createBringUpHandlers(host).item
