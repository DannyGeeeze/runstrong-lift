import ActivityKit
import Foundation

/// What the lock-screen Live Activity shows during a live workout.
/// Shared by the app (which starts and updates it) and the widget extension (which draws it).
struct WorkoutActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// "work", "hold", "countdown", "rest", "paused" or "done".
        var phase: String
        /// Exercise name, or "Rest" / "Switch sides".
        var title: String
        /// "Set 2 of 3", "Left side", etc.
        var detail: String
        /// Big text when there's no timer, e.g. "3-5" reps.
        var big: String?
        /// When the current countdown ends (rest, hold, 3-2-1). The lock screen counts down on its own.
        var endsAt: Date?
        /// Seconds left when paused (shown frozen).
        var pausedLeft: Double?
        /// Whole-workout progress, 0...1.
        var progress: Double
        /// What's coming next, e.g. "Bulgarian split squat · Set 2".
        var next: String?
    }

    /// e.g. "Full strength".
    var workoutTitle: String
}
