import { create } from "zustand"

interface UIState {
  sidebarOpen: boolean
  mobileNavOpen: boolean
  globalLoading: boolean
  modalOpen: boolean
  modalContent: string | null
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void
  toggleMobileNav: () => void
  setMobileNavOpen: (open: boolean) => void
  setGlobalLoading: (loading: boolean) => void
  openModal: (content: string) => void
  closeModal: () => void
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  mobileNavOpen: false,
  globalLoading: false,
  modalOpen: false,
  modalContent: null,
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleMobileNav: () => set((state) => ({ mobileNavOpen: !state.mobileNavOpen })),
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setGlobalLoading: (loading) => set({ globalLoading: loading }),
  openModal: (content) => set({ modalOpen: true, modalContent: content }),
  closeModal: () => set({ modalOpen: false, modalContent: null }),
}))
