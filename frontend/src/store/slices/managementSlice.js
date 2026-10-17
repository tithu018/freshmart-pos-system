import { createSlice, nanoid } from '@reduxjs/toolkit'
import { customers, employees } from '../../data/mockData'
const managementSlice = createSlice({
  name: 'management',
  initialState: {
    customers,
    employees,
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
    savePerson: (state, { payload: { type, person } }) => {
      const existing = state[type].find((item) => item.id === person.id)
      if (existing) Object.assign(existing, person)
      else
        state[type].unshift({
          ...person,
          id: `${type === 'customers' ? 'CUS' : 'EMP'}-${nanoid(6)}`,
        })
    },
    saveSettings: (state, { payload }) => {
      Object.assign(state.settings, payload)
    },
  },
})
export const { savePerson, saveSettings } = managementSlice.actions
export default managementSlice.reducer
