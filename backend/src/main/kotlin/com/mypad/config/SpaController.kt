package com.mypad.config

import org.springframework.stereotype.Controller
import org.springframework.web.bind.annotation.RequestMapping

@Controller
class SpaController {
    @RequestMapping(value = ["/{path:[^\\.]*}"])
    fun redirect(): String = "forward:/index.html"

    @RequestMapping(value = ["/**/{path:[^\\.]*}"])
    fun redirectNested(): String = "forward:/index.html"
}
