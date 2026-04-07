import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Role } from "@/lib/constants"
import type { Permission } from "@/lib/permissions"

interface EntityInfo {
  id: string
  name: string
  slug: string
  logo?: string | null
  role?: string
}

interface AuthState {
  permissions: Permission[]
  currentEnterpriseId: string | null
  currentOrganizationId: string | null
  accessibleEnterprises: EntityInfo[]
  accessibleOrganizations: (EntityInfo & { enterpriseId?: string | null })[]
  isInitialized: boolean

  setPermissions: (permissions: Permission[]) => void
  setCurrentEnterprise: (enterpriseId: string | null) => void
  setCurrentOrganization: (orgId: string | null) => void
  setAccessibleEntities: (
    enterprises: EntityInfo[],
    organizations: (EntityInfo & { enterpriseId?: string | null })[]
  ) => void
  initialize: (data: {
    permissions: Permission[]
    enterprises: EntityInfo[]
    organizations: (EntityInfo & { enterpriseId?: string | null })[]
    currentEnterpriseId?: string | null
    currentOrganizationId?: string | null
  }) => void
  reset: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      permissions: [],
      currentEnterpriseId: null,
      currentOrganizationId: null,
      accessibleEnterprises: [],
      accessibleOrganizations: [],
      isInitialized: false,

      setPermissions: (permissions) => set({ permissions }),
      setCurrentEnterprise: (currentEnterpriseId) =>
        set({ currentEnterpriseId, currentOrganizationId: null }),
      setCurrentOrganization: (currentOrganizationId) => set({ currentOrganizationId }),
      setAccessibleEntities: (accessibleEnterprises, accessibleOrganizations) =>
        set({ accessibleEnterprises, accessibleOrganizations }),
      initialize: (data) =>
        set({
          permissions: data.permissions,
          accessibleEnterprises: data.enterprises,
          accessibleOrganizations: data.organizations,
          currentEnterpriseId: data.currentEnterpriseId || null,
          currentOrganizationId: data.currentOrganizationId || null,
          isInitialized: true,
        }),
      reset: () =>
        set({
          permissions: [],
          currentEnterpriseId: null,
          currentOrganizationId: null,
          accessibleEnterprises: [],
          accessibleOrganizations: [],
          isInitialized: false,
        }),
    }),
    {
      name: "eventflow-auth",
      partialize: (state) => ({
        currentEnterpriseId: state.currentEnterpriseId,
        currentOrganizationId: state.currentOrganizationId,
      }),
    }
  )
)
