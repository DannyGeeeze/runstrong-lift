import ActivityKit
import Capacitor
import Foundation

/// Lets the web app start, update and end the workout Live Activity.
/// JavaScript side: lib/native.ts (`LiveActivity.start / update / end`).
@objc(LiveActivityPlugin)
public class LiveActivityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "LiveActivityPlugin"
    public let jsName = "LiveActivity"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    private var current: Activity<WorkoutActivityAttributes>? {
        Activity<WorkoutActivityAttributes>.activities.first
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": ActivityAuthorizationInfo().areActivitiesEnabled])
    }

    @objc func start(_ call: CAPPluginCall) {
        let state = Self.state(from: call)
        let title = call.getString("workoutTitle") ?? "Workout"
        Task {
            // Only one workout at a time: clear any left over from before.
            for activity in Activity<WorkoutActivityAttributes>.activities {
                await activity.end(nil, dismissalPolicy: .immediate)
            }
            do {
                let activity = try Activity.request(
                    attributes: WorkoutActivityAttributes(workoutTitle: title),
                    content: .init(state: state, staleDate: nil),
                    pushType: nil
                )
                call.resolve(["id": activity.id])
            } catch {
                call.reject("Couldn't start the Live Activity: \(error.localizedDescription)")
            }
        }
    }

    @objc func update(_ call: CAPPluginCall) {
        let state = Self.state(from: call)
        Task {
            guard let activity = current else {
                call.resolve()
                return
            }
            await activity.update(.init(state: state, staleDate: nil))
            call.resolve()
        }
    }

    @objc func end(_ call: CAPPluginCall) {
        let finished = call.getBool("finished") ?? false
        let state = Self.state(from: call)
        Task {
            for activity in Activity<WorkoutActivityAttributes>.activities {
                if finished {
                    // Leave the "Workout complete" card up for a few minutes.
                    await activity.end(.init(state: state, staleDate: nil), dismissalPolicy: .after(.now.addingTimeInterval(5 * 60)))
                } else {
                    await activity.end(nil, dismissalPolicy: .immediate)
                }
            }
            call.resolve()
        }
    }

    private static func state(from call: CAPPluginCall) -> WorkoutActivityAttributes.ContentState {
        let endsAtMs = call.getDouble("endsAt")
        return .init(
            phase: call.getString("phase") ?? "work",
            title: call.getString("title") ?? "",
            detail: call.getString("detail") ?? "",
            big: call.getString("big"),
            endsAt: endsAtMs.map { Date(timeIntervalSince1970: $0 / 1000) },
            pausedLeft: call.getDouble("pausedLeft"),
            progress: min(1, max(0, call.getDouble("progress") ?? 0)),
            next: call.getString("next")
        )
    }
}
