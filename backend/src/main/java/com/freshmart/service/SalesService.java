package com.freshmart.service;

import com.freshmart.dto.*;
import com.freshmart.model.*;
import com.freshmart.repository.SaleRepository;
import com.freshmart.repository.CustomerRepository;
import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.validation.annotation.Validated;

@Service
@Validated
public class SalesService {
    public static final BigDecimal MAX_TOTAL = new BigDecimal("1000000000.00");
    private final SaleRepository sales;
    private final InventoryService inventory;
    private final TransactionTemplate transaction;
    private final BigDecimal taxRate;
    private final CustomerRepository customers;

    public SalesService(SaleRepository sales, InventoryService inventory, TransactionTemplate transaction, CustomerRepository customers,
            @Value("${app.checkout.tax-rate:0}") BigDecimal taxRate) {
        this.sales = sales; this.inventory = inventory; this.transaction = transaction; this.customers = customers;
        if (taxRate.signum() < 0 || taxRate.compareTo(new BigDecimal("100")) > 0 || taxRate.stripTrailingZeros().scale() > 2)
            throw new IllegalArgumentException("Checkout tax rate must be between 0 and 100 with at most two decimal places.");
        this.taxRate = taxRate.setScale(2);
    }
    public BigDecimal taxRate() { return taxRate; }
    public List<InventoryResponse> catalog(String q, String categoryId) {
        return inventory.list(q, categoryId, null).stream().filter(p -> p.productStatus() == CatalogStatus.ACTIVE).toList();
    }

    public CheckoutResponse checkout(@Valid CheckoutRequest request, UserResponse actor) {
        var items = request.items().stream().sorted(Comparator.comparing(CheckoutRequest.Item::productId)).toList();
        if (items.stream().map(CheckoutRequest.Item::productId).distinct().count() != items.size())
            throw new CatalogException(400, "DUPLICATE_PRODUCT", "Combine repeated products into one cart line.");
        String key = request.idempotencyKey().toLowerCase(Locale.ROOT);
        String hash = fingerprint(request, items);
        try {
            return transaction.execute(status -> {
                var existing = sales.findByIdempotencyKey(key);
                if (existing.isPresent()) return replay(existing.get(), hash, actor);
                if (request.expectedTaxRate().compareTo(taxRate) != 0)
                    throw new CatalogException(409, "TAX_CHANGED", "Tax settings changed. Refresh and review the order before checkout.");
                // The unique key is reserved before touching stock. Competing inserts wait
                // for this transaction; rollback releases both the key and all stock changes.
                Sale sale = sales.saveAndFlush(new Sale(key, hash, actor, request.payment(), taxRate));
                if (request.customerId() != null) {
                    var customer = customers.lockById(request.customerId()).orElseThrow(() -> CatalogException.missing("Customer"));
                    if (!customer.isEnabled()) throw new CatalogException(409, "CUSTOMER_INACTIVE", "This customer is inactive. Select another customer or use guest checkout.");
                    sale.customer(customer);
                }
                BigDecimal subtotal = BigDecimal.ZERO;
                for (var item : items) {
                    var product = inventory.lockForCheckout(item.productId());
                    if (product.productStatus() != CatalogStatus.ACTIVE)
                        throw new CatalogException(409, "PRODUCT_UNAVAILABLE", product.name() + " is no longer active. Remove it from the order.");
                    if (item.expectedUnitPrice().compareTo(product.price()) != 0)
                        throw new CatalogException(409, "PRICE_CHANGED", product.name() + " has a new price. Refresh and review the order before checkout.");
                    var line = new SaleItem(sale, product, item.quantity());
                    subtotal = subtotal.add(line.getLineTotal());
                    if (subtotal.compareTo(MAX_TOTAL) > 0)
                        throw new CatalogException(400, "ORDER_LIMIT", "The order exceeds the supported total of 1,000,000,000.");
                    sale.addItem(line);
                    inventory.deductForSale(item.productId(), new StockAdjustmentRequest(StockOperation.STOCK_OUT,
                            item.quantity(), "Checkout sale " + sale.getId()), actor, sale.getId());
                }
                if (request.discount().compareTo(subtotal) > 0)
                    throw new CatalogException(400, "INVALID_DISCOUNT", "Discount cannot exceed the subtotal.");
                BigDecimal tax = subtotal.subtract(request.discount()).multiply(taxRate).movePointLeft(2).setScale(2, RoundingMode.HALF_UP);
                sale.totals(subtotal, request.discount(), tax);
                if (sale.getTotal().compareTo(MAX_TOTAL) > 0)
                    throw new CatalogException(400, "ORDER_LIMIT", "The order exceeds the supported total of 1,000,000,000.");
                sales.flush();
                return CheckoutResponse.from(sale);
            });
        } catch (DataIntegrityViolationException conflict) {
            // A fresh transaction is essential: PostgreSQL aborts the losing insert's
            // transaction. Only return a committed sale with the same actor and payload.
            return transaction.execute(status -> sales.findByIdempotencyKey(key)
                    .map(sale -> replay(sale, hash, actor)).orElseThrow(() -> conflict));
        }
    }
    private CheckoutResponse replay(Sale sale, String hash, UserResponse actor) {
        if (!sale.getUserId().equals(actor.id()) || !sale.getRequestHash().equals(hash))
            throw new CatalogException(409, "IDEMPOTENCY_CONFLICT", "This checkout key belongs to a different order or user.");
        return CheckoutResponse.from(sale);
    }
    private String fingerprint(CheckoutRequest request, List<CheckoutRequest.Item> items) {
        StringBuilder value = new StringBuilder(request.payment().name()).append('|')
                .append(request.discount().setScale(2).toPlainString()).append('|')
                .append(request.expectedTaxRate().setScale(2).toPlainString());
        for (var i : items) value.append('|').append(i.productId().length()).append(':').append(i.productId())
                .append(':').append(i.quantity()).append(':').append(i.expectedUnitPrice().setScale(2).toPlainString());
        // Keep the original fingerprint for guests, including retries from earlier tasks.
        if (request.customerId() != null) value.append("|customer:").append(request.customerId().length()).append(':').append(request.customerId());
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.toString().getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
}
