import { createSlice } from '@reduxjs/toolkit'
const managementSlice = createSlice({
  name: 'management',
  initialState: {
    settings: {
      storeName: 'FreshMart',
      email: 'hello@freshmart.com',
      phone: '+94 11 234 5678',
      address: '42 Green Avenue, Colombo',
      taxRate: 0,
      lowStockAlerts: true,
      receiptFooter: 'Thank you for shopping fresh. See you again!',
    },
  },
  reducers: {
    saveSettings: (state, { payload }) => {
      Object.assign(state.settings, payload)
    },
  },
})
export const { saveSettings } = managementSlice.actions
export default managementSlice.reducer
