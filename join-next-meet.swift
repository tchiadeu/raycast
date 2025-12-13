#!/usr/bin/swift

// Required parameters:
// @raycast.schemaVersion 1
// @raycast.title Join Meet
// @raycast.mode silent

// Optional parameters:
// @raycast.icon 📅

// Conditional parameters:
// @raycast.refreshTime 1m

// Documentation:
// @raycast.author tchiadeu

import Foundation
import EventKit

let store = EKEventStore()
let semaphore = DispatchSemaphore(value: 0)

store.requestFullAccessToEvents { granted, error in
    guard granted else {
        print("Access to calendar denied")
        semaphore.signal()
        return
    }

    let calendars = store.calendars(for: .event)
    let now = Date()
    let start = now.addingTimeInterval(-5 * 60)
    let future = now.addingTimeInterval(5 * 60)

    let predicate = store.predicateForEvents(withStart: start, end: future, calendars: calendars)
    let events = store.events(matching: predicate)
    if let event = events.first {
        if let notes = event.notes {
            if notes.contains("https://meet.google.com/") {
                let calendarName = event.calendar.title

                let profileMap = [
                    "Perso": "Profile 6",
                    "vetomatic": "Profile 1",
                    "Pro": "Profile 2",
                    "zélit": "Profile 5"
                ]
                let profileDir = profileMap[calendarName]

                let process = Process()
                process.launchPath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
                process.arguments = ["--profile-directory=\(profileDir ?? "Profile 2")", "--app-id=kjgfgldnnfoeklkmfkjfagphfepbbdan"]
                process.launch()
            }
        }
    } else {
        print("Aucun événement trouvé")
    }

    semaphore.signal()
}


semaphore.wait()
