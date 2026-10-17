import { createSlice } from '@reduxjs/toolkit'
import { sales } from '../../data/mockData'
const salesSlice = createSlice({
  name: 'sales',
  initialState: { items: sales },
  reducers: {
    addSale: (state, { payload }) => {
      state.items.unshift(payload)
    },
  },
})
export const { addSale } = salesSlice.actions
export default salesSlice.reducer
