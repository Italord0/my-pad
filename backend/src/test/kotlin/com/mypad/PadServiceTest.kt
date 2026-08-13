package com.mypad

import com.mypad.model.Pad
import com.mypad.repository.PadRepository
import com.mypad.service.PadService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class PadServiceTest {

    @Test
    fun `getOrCreate should create empty pad when missing`() {
        val repository = InMemoryPadRepository()
        val service = PadService(repository)

        val pad = service.getOrCreate("novo-pad")

        assertThat(pad.slug).isEqualTo("novo-pad")
        assertThat(pad.content).isEmpty()
    }

    @Test
    fun `update should persist latest content`() {
        val repository = InMemoryPadRepository()
        val service = PadService(repository)

        service.getOrCreate("meu-pad")
        val updated = service.update("meu-pad", "Olá mundo!")

        assertThat(updated.slug).isEqualTo("meu-pad")
        assertThat(updated.content).isEqualTo("Olá mundo!")
        assertThat(service.getOrCreate("meu-pad").content).isEqualTo("Olá mundo!")
    }
}

class InMemoryPadRepository : PadRepository {
    private val pads = mutableMapOf<String, Pad>()

    override fun findBySlug(slug: String): Pad? = pads[slug]

    override fun save(pad: Pad): Pad {
        pads[pad.slug] = pad
        return pad
    }
}
