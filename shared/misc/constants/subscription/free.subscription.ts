/**
 * Copyright (C) 2025 Monadfix OÜ
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { ObjectValues, SubscriptionPlansList } from './types'
import { UNLIMITED_ENTITY_LIMIT } from './utils'

export const FreeSubscriptionId = {
  free: 'free',
  // Everything unlocked, no billing. Assigned automatically when SELF_HOSTED_PLAN=true.
  selfHosted: 'self_hosted',
} as const

export type FreeSubscriptionId = ObjectValues<typeof FreeSubscriptionId>

export const FreeSubscriptionPlans: SubscriptionPlansList<FreeSubscriptionId> = {
  [FreeSubscriptionId.free]: {
    id: FreeSubscriptionId.free,
    priceCents: 0,
    entities: {
      workspaces: {
        limit: 1,
        exceedPerItemPriceId: null,
      },
      collabWorkspaces: {
        limit: 0,
        exceedPerItemPriceId: null,
      },
      collabWorkspacesUsers: {
        limit: 0,
        exceedPerItemPriceId: null,
      },
      domains: {
        limit: 0,
        exceedPerItemPriceId: null,
      },
      subdomains: {
        limit: 2,
        exceedPerItemPriceId: null,
      },
      collabPagesUsers: {
        limit: 0,
        exceedPerItemPriceId: null,
      },
    },
    canWeeklyBackups: false,
    haveFontSettings: false,
    mandatoryAnalytics: true,
    privatePages: false,
  },
  [FreeSubscriptionId.selfHosted]: {
    id: FreeSubscriptionId.selfHosted,
    priceCents: 0,
    entities: {
      workspaces: { limit: UNLIMITED_ENTITY_LIMIT, exceedPerItemPriceId: null },
      collabWorkspaces: { limit: UNLIMITED_ENTITY_LIMIT, exceedPerItemPriceId: null },
      collabWorkspacesUsers: { limit: UNLIMITED_ENTITY_LIMIT, exceedPerItemPriceId: null },
      domains: { limit: UNLIMITED_ENTITY_LIMIT, exceedPerItemPriceId: null },
      subdomains: { limit: UNLIMITED_ENTITY_LIMIT, exceedPerItemPriceId: null },
      collabPagesUsers: { limit: UNLIMITED_ENTITY_LIMIT, exceedPerItemPriceId: null },
    },
    canWeeklyBackups: true,
    haveFontSettings: true,
    mandatoryAnalytics: false,
    privatePages: true,
  },
} as const