package com.freshmart;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class TestDatabaseSafetyTest {
    @Test void permitsOnlyExplicitlyIsolatedTestLocations() {
        for (String url : new String[] { "jdbc:h2:mem:freshmart-test;MODE=PostgreSQL", "jdbc:postgresql://127.0.0.1:54321/freshmart_test",
                "jdbc:postgresql://localhost/freshmart_pos?currentSchema=people_test_0123456789abcdef0123456789abcdef",
                "jdbc:postgresql://localhost/freshmart_pos?currentSchema=analytics_test_0123456789abcdef0123456789abcdef" })
            assertThatCode(() -> TestDatabaseSafety.validate(url)).doesNotThrowAnyException();
    }
    @Test void blocksStoreDatabasesPublicFallbacksAndFileBackedDatabasesWithoutLeakingUrls() {
        for (String url : new String[] { "jdbc:postgresql://localhost:5432/freshmart_pos", "jdbc:postgresql://localhost/freshmart_pos?currentSchema=public",
                "jdbc:postgresql://localhost/freshmart_pos?currentSchema=people_test_0123456789abcdef0123456789abcdef,public",
                "jdbc:postgresql://localhost/freshmart_test?currentSchema=public", "jdbc:h2:file:./store", "jdbc:postgresql://secret:password@localhost/store", "", null })
            assertThatThrownBy(() -> TestDatabaseSafety.validate(url)).isInstanceOf(IllegalStateException.class)
                    .hasMessageContaining("Store data is not allowed").hasMessageNotContaining("password");
    }
}
