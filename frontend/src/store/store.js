import { configureStore } from '@reduxjs/toolkit'

export const store = configureStore({
  // Replace this empty reducer with feature slices when features are added.
  reducer: (state = {}) => state,
})
