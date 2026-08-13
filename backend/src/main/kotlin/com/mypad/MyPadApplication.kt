package com.mypad

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import java.nio.file.Files
import java.nio.file.Paths

@SpringBootApplication
class MyPadApplication

fun main(args: Array<String>) {
    val dbDir = Paths.get("data")
    Files.createDirectories(dbDir)

    val dbFile = dbDir.resolve("dontpad.db")
    if (!Files.exists(dbFile)) {
        Files.createFile(dbFile)
    }

    runApplication<MyPadApplication>(*args)
}
