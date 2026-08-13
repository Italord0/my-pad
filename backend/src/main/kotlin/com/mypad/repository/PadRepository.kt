package com.mypad.repository

import com.mypad.model.Pad
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import java.time.Instant

interface PadRepository {
    fun findBySlug(slug: String): Pad?
    fun save(pad: Pad): Pad
}

@Repository
class JdbcPadRepository(
    private val jdbcTemplate: JdbcTemplate,
) : PadRepository {

    init {
        jdbcTemplate.execute(
            """
            CREATE TABLE IF NOT EXISTS pads (
                slug TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """.trimIndent(),
        )
    }

    override fun findBySlug(slug: String): Pad? {
        return jdbcTemplate.query(
            "SELECT slug, content, created_at, updated_at FROM pads WHERE slug = ?",
            { rs, _ ->
                Pad(
                    slug = rs.getString("slug"),
                    content = rs.getString("content"),
                    createdAt = Instant.parse(rs.getString("created_at")),
                    updatedAt = Instant.parse(rs.getString("updated_at")),
                )
            },
            slug,
        ).firstOrNull()
    }

    override fun save(pad: Pad): Pad {
        val existing = findBySlug(pad.slug)

        if (existing == null) {
            jdbcTemplate.update(
                "INSERT INTO pads (slug, content, created_at, updated_at) VALUES (?, ?, ?, ?)",
                pad.slug,
                pad.content,
                pad.createdAt.toString(),
                pad.updatedAt.toString(),
            )
        } else {
            jdbcTemplate.update(
                "UPDATE pads SET content = ?, updated_at = ? WHERE slug = ?",
                pad.content,
                pad.updatedAt.toString(),
                pad.slug,
            )
        }

        return findBySlug(pad.slug) ?: pad
    }
}
