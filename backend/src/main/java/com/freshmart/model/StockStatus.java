package com.freshmart.model;

public enum StockStatus {
    IN_STOCK, LOW_STOCK, OUT_OF_STOCK;
    public static StockStatus of(Inventory inventory) {
        return inventory.getStock() == 0 ? OUT_OF_STOCK
                : inventory.getStock() < inventory.getMinStock() ? LOW_STOCK : IN_STOCK;
    }
}
