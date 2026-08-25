package com.mypad.config

import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.GetMapping

@Controller
class SpaController {
    @GetMapping(value = ["/", "/{slug:[^\\.]+}"])
    fun index(): String = "forward:/index.html"
}
