#!/usr/bin/swift

// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Whisper Transcript
// @raycast.mode silent

// Optional parameters:
// @raycast.icon 🎙️

// Documentation:
// @raycast.author tchiadeu

import Foundation
import AppKit

class AudioRecorderMac {
    let audioFilePath: String
    let stateFilePath: String

    init() {
        let tempDir = NSTemporaryDirectory()
        audioFilePath = (tempDir as NSString).appendingPathComponent("whisper_recording.m4a")
        stateFilePath = (tempDir as NSString).appendingPathComponent("whisper_state.txt")
    }

    func isRecording() -> Bool {
        return FileManager.default.fileExists(atPath: stateFilePath)
    }

    func getPID() -> Int? {
        guard let pidStr = try? String(contentsOfFile: stateFilePath, encoding: .utf8) else {
            return nil
        }
        return Int(pidStr.trimmingCharacters(in: .whitespacesAndNewlines))
    }

    func startRecording() -> Bool {
        let process = Process()

        process.executableURL = URL(fileURLWithPath: "/opt/homebrew/bin/ffmpeg")
        process.arguments = [
            "-f", "avfoundation",
            "-i", ":1",
            "-acodec", "aac",
            "-ab", "128k",
            "-ac", "1",
            "-ar", "16000",
            audioFilePath
        ]

        let pipe = Pipe()
        process.standardOutput = pipe
        process.standardError = pipe

        do {
            try process.run()
            let pid = process.processIdentifier
            try String(pid).write(toFile: stateFilePath, atomically: true, encoding: .utf8)
            print("Recording started...")
            sleep(1)
            return true
        } catch {
            print("Failed to start recording: \(error.localizedDescription)")
            return false
        }
    }

    func stopRecording() -> String? {
        guard let pid = getPID() else {
            print("No active recording found")
            return nil
        }

        let killProcess = Process()
        killProcess.executableURL = URL(fileURLWithPath: "/bin/kill")
        killProcess.arguments = ["-TERM", String(pid)]

        do {
            try killProcess.run()
            killProcess.waitUntilExit()

            try FileManager.default.removeItem(atPath: stateFilePath)

            if FileManager.default.fileExists(atPath: audioFilePath) {
                print("Recording stopped")
                return audioFilePath
            }

            return nil
        } catch {
            print("Failed to stop recording: \(error.localizedDescription)")
            return nil
        }
    }

    func cleanup() {
        try? FileManager.default.removeItem(atPath: audioFilePath)
        try? FileManager.default.removeItem(atPath: stateFilePath)

        let baseName = (audioFilePath as NSString).lastPathComponent
        let txtFile = ((audioFilePath as NSString).deletingLastPathComponent as NSString)
            .appendingPathComponent(baseName.replacingOccurrences(of: ".m4a", with: ".txt"))
        try? FileManager.default.removeItem(atPath: txtFile)
    }
}

func runWhisper(audioPath: String) -> Bool {
    let process = Process()
    process.executableURL = URL(fileURLWithPath: "/Users/kevintchiadeu/.pyenv/shims/whisper")

    let outputDir = (audioPath as NSString).deletingLastPathComponent

    process.arguments = [
        audioPath,
        "--model", "base",
        "--language", "fr",
        "--output_format", "txt",
        "--output_dir", outputDir
    ]

    let pipe = Pipe()
    process.standardOutput = pipe
    process.standardError = pipe

    do {
        try process.run()
        process.waitUntilExit()

        print("Transcription completed")
        return process.terminationStatus == 0
    } catch {
        print("Whisper error: \(error.localizedDescription)")
        return false
    }
}

func getTranscriptText(audioPath: String) -> String? {
    let baseName = ((audioPath as NSString).lastPathComponent as NSString).deletingPathExtension
    let dirPath = (audioPath as NSString).deletingLastPathComponent
    let txtPath = (dirPath as NSString).appendingPathComponent("\(baseName).txt")

    do {
        let transcript = try String(contentsOfFile: txtPath, encoding: .utf8)
        return transcript.trimmingCharacters(in: .whitespacesAndNewlines)
    } catch {
        print("Failed to read transcript: \(error.localizedDescription)")
        return nil
    }
}

func pasteToClipboard(_ text: String) {
    let pasteboard = NSPasteboard.general
    pasteboard.clearContents()
    pasteboard.setString(text, forType: .string)

    let appleScript = """
    tell application "System Events"
        keystroke "v" using command down
    end tell
    """

    let task = Process()
    task.launchPath = "/usr/bin/osascript"
    task.arguments = ["-e", appleScript]

    do {
        try task.run()
        task.waitUntilExit()
        print("Text pasted at cursor")
    } catch {
        print("Paste failed: \(error.localizedDescription)")
    }
}

let recorder = AudioRecorderMac()

if recorder.isRecording() {
    print("Stopping recording...")

    if let audioURL = recorder.stopRecording() {

        if runWhisper(audioPath: audioURL) {

            if let transcript = getTranscriptText(audioPath: audioURL) {
                pasteToClipboard(transcript)
            }
        }

        recorder.cleanup()
    }
} else {
    print("Starting recording...")

    if !recorder.startRecording() {
        exit(1)
    }
}
