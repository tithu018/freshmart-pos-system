package com.freshmart.service;

public class CatalogException extends RuntimeException {
    private final int status;
    private final String code;
    public CatalogException(int status, String code, String message) {
        super(message); this.status = status; this.code = code;
    }
    public int getStatus() { return status; }
    public String getCode() { return code; }
    public static CatalogException missing(String entity) {
        return new CatalogException(404, "NOT_FOUND", entity + " not found.");
    }
}
