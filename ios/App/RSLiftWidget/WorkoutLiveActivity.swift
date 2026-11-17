import ActivityKit
import SwiftUI
import WidgetKit

private let accent = Color(red: 1.0, green: 0.416, blue: 0.2) // #ff6a33
private let card = Color(red: 0.075, green: 0.07, blue: 0.063) // near-black

/// Lock-screen card + Dynamic Island for a live workout.
struct WorkoutLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            LockScreenCard(state: context.state, workoutTitle: context.attributes.workoutTitle)
                .activityBackgroundTint(card)
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let s = context.state
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    Text(phaseLabel(s))
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(accent)
                        .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    BigReadout(state: s)
                        .font(.title2.weight(.bold))
                        .padding(.trailing, 4)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(s.title).font(.headline).lineLimit(1)
                        Text(s.detail).font(.subheadline).foregroundStyle(.secondary).lineLimit(1)
                        ProgressView(value: s.progress).tint(accent)
                    }
                    .padding(.horizontal, 4)
                }
            } compactLeading: {
                Image(systemName: icon(s)).foregroundStyle(accent)
            } compactTrailing: {
                BigReadout(state: s)
                    .font(.caption.weight(.semibold))
                    .frame(maxWidth: 52)
            } minimal: {
                Image(systemName: icon(s)).foregroundStyle(accent)
            }
        }
    }
}

private struct LockScreenCard: View {
    let state: WorkoutActivityAttributes.ContentState
    let workoutTitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("RS LIFT")
                    .font(.caption2.weight(.heavy))
                    .foregroundStyle(accent)
                Text(workoutTitle.uppercased())
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.6))
                    .lineLimit(1)
                Spacer()
                Text(phaseLabel(state))
                    .font(.caption.weight(.bold))
                    .foregroundStyle(accent)
            }

            HStack(alignment: .center, spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(state.title)
                        .font(.title3.weight(.bold))
                        .foregroundStyle(.white)
                        .lineLimit(2)
                        .minimumScaleFactor(0.8)
                    Text(state.detail)
                        .font(.subheadline)
                        .foregroundStyle(.white.opacity(0.65))
                        .lineLimit(1)
                }
                Spacer(minLength: 8)
                BigReadout(state: state)
                    .font(.system(size: 44, weight: .bold, design: .rounded))
                    .foregroundStyle(.white)
            }

            ProgressView(value: state.progress)
                .tint(accent)

            if let next = state.next, !next.isEmpty {
                Text("Up next: \(next)")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.7))
                    .lineLimit(1)
            }
        }
        .padding(16)
    }
}

/// The big number: a live countdown when a timer is running, frozen time when paused, otherwise the reps.
private struct BigReadout: View {
    let state: WorkoutActivityAttributes.ContentState

    var body: some View {
        if state.phase == "paused", let left = state.pausedLeft {
            Text(clock(left)).monospacedDigit()
        } else if let end = state.endsAt, end > .now {
            // Counts down on the lock screen by itself, even with the app asleep.
            Text(timerInterval: Date.now...end, countsDown: true)
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
        } else if let big = state.big {
            Text(big).monospacedDigit()
        } else if state.phase == "done" {
            Image(systemName: "checkmark.circle.fill").foregroundStyle(accent)
        } else {
            Text("Go")
        }
    }
}

private func phaseLabel(_ s: WorkoutActivityAttributes.ContentState) -> String {
    switch s.phase {
    case "rest": return "REST"
    case "hold": return "HOLD"
    case "countdown": return "GET READY"
    case "paused": return "PAUSED"
    case "done": return "DONE"
    default: return "LIFT"
    }
}

private func icon(_ s: WorkoutActivityAttributes.ContentState) -> String {
    switch s.phase {
    case "rest": return "timer"
    case "paused": return "pause.fill"
    case "done": return "checkmark"
    default: return "figure.strengthtraining.traditional"
    }
}

private func clock(_ seconds: Double) -> String {
    let s = max(0, Int(seconds.rounded(.up)))
    return String(format: "%d:%02d", s / 60, s % 60)
}
