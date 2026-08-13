package com.mypad.controller

import com.mypad.service.PadService
import com.mypad.websocket.PadSocketMessage
import org.springframework.messaging.simp.SimpMessagingTemplate
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
    private val messagingTemplate: SimpMessagingTemplate,
) {

    @GetMapping("/pads/{slug}")
    fun getPad(@PathVariable slug: String): PadResponse {
        val pad = padService.getOrCreate(slug)
        return PadResponse.fromPad(pad.slug, pad.content, pad.createdAt, pad.updatedAt)
    }

    @PutMapping("/pads/{slug}")
    fun updatePad(
        @PathVariable slug: String,
        @RequestBody request: PadUpdateRequest,
        @org.springframework.web.bind.annotation.RequestHeader("X-Sender-Id", required = false) senderId: String?,
    ): PadResponse {
        val pad = padService.update(slug, request.content)
        // Broadcast update to websocket subscribers so REST updates propagate immediately
        messagingTemplate.convertAndSend(
            "/topic/pads/$slug",
            PadSocketMessage(type = "update", content = pad.content, senderId = senderId),
        )
        return PadResponse.fromPad(pad.slug, pad.content, pad.createdAt, pad.updatedAt)
    }
}
