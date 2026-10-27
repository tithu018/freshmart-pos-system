package com.freshmart;

import java.net.URI;
import org.springframework.context.ApplicationContextInitializer;
import org.springframework.context.ConfigurableApplicationContext;

/** Runs before Flyway or fixture cleanup can touch an accidentally overridden datasource. */
public class TestDatabaseSafety implements ApplicationContextInitializer<ConfigurableApplicationContext> {
    static void validate(String url) {
        if (url != null && url.startsWith("jdbc:h2:mem:")) return;
        if (url != null && url.startsWith("jdbc:postgresql://")) {
            try {
                URI connection = URI.create(url.substring(5));
                String query = connection.getRawQuery();
                boolean dedicatedDatabase = connection.getPath().matches("/(freshmart|analytics|people)_test") && query == null;
                boolean dedicatedSchema = query != null && query.matches("currentSchema=(analytics|people)_test_[a-f0-9]{32}");
                if (dedicatedDatabase || dedicatedSchema) return;
            } catch (IllegalArgumentException ignored) { /* Fail closed without echoing the connection string. */ }
        }
        throw new IllegalStateException("Tests require an in-memory database or an isolated PostgreSQL test database/schema. Store data is not allowed.");
    }
    @Override public void initialize(ConfigurableApplicationContext context) {
        validate(context.getEnvironment().getProperty("spring.datasource.url"));
    }
}
