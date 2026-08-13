package com.mypad.controller

import com.mypad.service.PadService
import org.springframework.web.bind.annotation.CrossOrigin
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestMethod
import org.springframework.web.bind.annotation.RestController
import java.time.Instant

data class PadResponse(
    val slug: String,
    val content: String,
    val createdAt: Instant,
    val updatedAt: Instant,
) {
    companion object {
        fun fromPad(slug: String, content: String, createdAt: Instant, updatedAt: Instant): PadResponse =
            PadResponse(slug, content, createdAt, updatedAt)
    }
}

data class PadUpdateRequest(
    val content: String = "",
)

@CrossOrigin(
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allowedHeaders = ["*"],
    methods = [RequestMethod.GET, RequestMethod.PUT, RequestMethod.OPTIONS],
)
@RestController
@RequestMapping("/api")
class PadController(
    private val padService: PadService,
) {

    @GetMapping("/pads/{slug}")
    fun getPad(@PathVariable slug: String): PadResponse {
        val pad = padService.getOrCreate(slug)
        return PadResponse.fromPad(pad.slug, pad.content, pad.createdAt, pad.updatedAt)
    }

    @PutMapping("/pads/{slug}")
    fun updatePad(@PathVariable slug: String, @RequestBody request: PadUpdateRequest): PadResponse {
        val pad = padService.update(slug, request.content)
        return PadResponse.fromPad(pad.slug, pad.content, pad.createdAt, pad.updatedAt)
    }
}
