buildscript {
    repositories {
        maven { url=uri("https://maven.aliyun.com/nexus/content/groups/public/")}
        google()
        mavenCentral()
    }
    dependencies {
        classpath("com.android.tools.build:gradle:8.5.1")
        classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.25")
    }
}

allprojects {
    repositories {
        maven { url=uri("https://maven.aliyun.com/nexus/content/groups/public/")}
        google()
        mavenCentral()
    }
}

tasks.register("clean").configure {
    delete("build")
}

