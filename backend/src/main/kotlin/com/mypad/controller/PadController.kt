package com.mypad.controller

import com.mypad.service.PadService
import com.mypad.websocket.PadSocketMessage
import jakarta.servlet.http.HttpServletRequest
import org.springframework.messaging.simp.SimpMessagingTemplate
import org.springframework.web.bind.annotation.*
import java.time.Instant

data class PadResponse(
    val slug: String,
    val content: String,
    val createdAt: Instant,
    val updatedAt: Instant,
    val children: List<String> = emptyList(),
) {
    companion object {
        fun fromPad(
            slug: String,
            content: String,
            createdAt: Instant,
            updatedAt: Instant,
            children: List<String> = emptyList()
        ): PadResponse =
            PadResponse(slug, content, createdAt, updatedAt, children)
    }
}

data class PadUpdateRequest(
    val content: String = "",
)

@RestController
@RequestMapping("/api")
class PadController(
    private val padService: PadService,
    private val messagingTemplate: SimpMessagingTemplate,
) {

    @GetMapping("/pads/**")
    fun getPad(request: HttpServletRequest): PadResponse {
        val prefix = request.contextPath + "/api/pads/"
        val uri = request.requestURI
        val slug = if (uri.length <= prefix.length) "meu-pad" else uri.substring(prefix.length)
        val pad = padService.getOrCreate(slug)
        val children = padService.getChildren(slug)
        return PadResponse.fromPad(pad.slug, pad.content, pad.createdAt, pad.updatedAt, children)
    }

    @PutMapping("/pads/**")
    fun updatePad(
        request: HttpServletRequest,
        @RequestBody body: PadUpdateRequest,
        @RequestHeader("X-Sender-Id", required = false) senderId: String?,
    ): PadResponse {
        val prefix = request.contextPath + "/api/pads/"
        val uri = request.requestURI
        val slug = if (uri.length <= prefix.length) "meu-pad" else uri.substring(prefix.length)
        val pad = padService.update(slug, body.content)
        // Broadcast update to websocket subscribers so REST updates propagate immediately
        messagingTemplate.convertAndSend(
            "/topic/pads/$slug",
            PadSocketMessage(type = "update", content = pad.content, senderId = senderId),
        )
        val children = padService.getChildren(slug)
        return PadResponse.fromPad(pad.slug, pad.content, pad.createdAt, pad.updatedAt, children)
    }
}
