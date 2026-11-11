# mobile

## Android build requirements

Install JDK 17 and the Android SDK. The project pins the Gradle daemon to
Java 17 in `android/gradle/gradle-daemon-jvm.properties`, independently of
the system Java version. Do not point Gradle to JDK 27 with Gradle 9.1.

If VS Code reports `Unsupported class file major version 71`, configure
`java.import.gradle.java.home` (Red Hat Java) and `jdk.project.jdkhome`
(Oracle Java) in your local workspace settings to your JDK 17 installation,
then run **Developer: Reload Window** and reload the Gradle project.
Oracle Java 27 requires JDK 21 or newer to run its language server. Set
`jdk.jdkhome` to a Gradle-compatible JDK such as JDK 21 as well; leaving
the server on JDK 27 can still break Gradle import even with the project
JDK set to 17. This setting is separate from `jdk.project.jdkhome`.
For terminal builds, set `JAVA_HOME` to JDK 17 before running Gradle.
Check the selected launcher and daemon JVM with `android/gradlew.bat --version`
from the mobile directory.

Set `sdk.dir` in the local, untracked `android/local.properties` file to
your Android SDK directory. Keep machine-specific paths out of committed files.
The SDK directory must be visible to both the terminal and VS Code. If they
see different AppData directories, an SDK installed in the ignored
`apps/mobile/.android-sdk/` directory can be shared by both; point `sdk.dir`
in `android/local.properties` to its absolute path.

A new Flutter project.

## Getting Started

This project is a starting point for a Flutter application.

A few resources to get you started if this is your first Flutter project:

- [Learn Flutter](https://docs.flutter.dev/get-started/learn-flutter)
- [Write your first Flutter app](https://docs.flutter.dev/get-started/codelab)
- [Flutter learning resources](https://docs.flutter.dev/reference/learning-resources)

For help getting started with Flutter development, view the
[online documentation](https://docs.flutter.dev/), which offers tutorials,
samples, guidance on mobile development, and a full API reference.
