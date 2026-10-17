// Inventory is derived from products so the two views share one source of truth.
export const selectLowStock = (state) =>
  state.products.items.filter((item) => item.stock < item.minStock)
