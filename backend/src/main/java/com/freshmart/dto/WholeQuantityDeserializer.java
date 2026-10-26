package com.freshmart.dto;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import java.io.IOException;

/** Do not let Jackson silently truncate decimal stock quantities. */
public class WholeQuantityDeserializer extends JsonDeserializer<Long> {
    @Override public Long deserialize(JsonParser parser, DeserializationContext context) throws IOException {
        if (!parser.hasToken(JsonToken.VALUE_NUMBER_INT)) return (Long) context.handleUnexpectedToken(Long.class, parser);
        return parser.getLongValue();
    }
}
