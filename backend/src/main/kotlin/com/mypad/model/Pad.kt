package com.mypad.model

import java.time.Instant

data class Pad(
    val slug: String,
    var content: String = "",
    val createdAt: Instant = Instant.now(),
    var updatedAt: Instant = Instant.now(),
)
