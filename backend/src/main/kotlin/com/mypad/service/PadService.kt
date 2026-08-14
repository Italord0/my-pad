package com.mypad.service

import com.mypad.model.Pad
import com.mypad.repository.PadRepository
import org.springframework.stereotype.Service
import java.time.Instant

@Service
class PadService(
    private val padRepository: PadRepository,
) {

    fun getOrCreate(slug: String): Pad {
        return padRepository.findBySlug(slug) ?: padRepository.save(Pad(slug = slug))
    }

    fun update(slug: String, content: String): Pad {
        val pad = getOrCreate(slug)
        pad.content = content
        pad.updatedAt = Instant.now()
        return padRepository.save(pad)
    }

    fun getChildren(parentSlug: String): List<String> {
        return padRepository.findChildren(parentSlug)
    }
}
