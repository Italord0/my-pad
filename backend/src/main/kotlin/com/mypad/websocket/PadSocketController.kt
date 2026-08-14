package com.mypad.websocket

import com.mypad.service.PadService
import org.springframework.messaging.handler.annotation.DestinationVariable
import org.springframework.messaging.handler.annotation.MessageMapping
import org.springframework.messaging.handler.annotation.SendTo
import org.springframework.stereotype.Controller

data class PadSocketMessage(
    val type: String,
    val content: String,
    val senderId: String? = null,
)

@Controller
class PadSocketController(
    private val padService: PadService,
) {

    @MessageMapping("/pads/{slug:.+}")
    @SendTo("/topic/pads/{slug}")
    fun handleUpdate(
        @DestinationVariable("slug") slug: String,
        message: PadSocketMessage,
    ): PadSocketMessage {
        if (message.type == "update") {
            padService.update(slug, message.content)
        }

        return PadSocketMessage(type = "update", content = padService.getOrCreate(slug).content, senderId = message.senderId)
    }
}
