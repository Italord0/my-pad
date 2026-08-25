package com.mypad

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.runApplication
import java.nio.file.Files
import java.nio.file.Paths

@SpringBootApplication
class MyPadApplication

fun main(args: Array<String>) {
    val dbFile = Paths.get(System.getenv("MYPAD_DB_FILE") ?: "./data/mypad.db")
    val dbDir = dbFile.parent ?: Paths.get(".")
    Files.createDirectories(dbDir)

    if (!Files.exists(dbFile)) {
        Files.createFile(dbFile)
    }

    runApplication<MyPadApplication>(*args)
}
