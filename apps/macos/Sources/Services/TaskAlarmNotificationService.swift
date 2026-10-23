import Foundation
import UserNotifications

actor TaskAlarmNotificationService {
    static let shared = TaskAlarmNotificationService()

    private let center = UNUserNotificationCenter.current()

    func requestAndSchedule(task: TaskItem, at date: Date) async {
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            guard granted else { return }
            await schedule(task: task, at: date)
        } catch {
            // The durable Needs Attention state still works if notification permission is unavailable.
        }
    }

    func sync(tasks: [TaskItem]) async {
        let settings = await center.notificationSettings()
        guard settings.authorizationStatus == .authorized
                || settings.authorizationStatus == .provisional else { return }

        for task in tasks {
            guard task.status == .open,
                  let alarmAt = task.alarmAt,
                  task.alarmClearedAt == nil else {
                await cancel(taskID: task.id)
                continue
            }
            if task.alarmNotifiedAt != nil {
                center.removePendingNotificationRequests(withIdentifiers: [identifier(task.id)])
                continue
            }
            await schedule(task: task, at: alarmAt)
        }
    }

    func cancel(taskID: UUID) async {
        center.removePendingNotificationRequests(withIdentifiers: [identifier(taskID)])
        center.removeDeliveredNotifications(withIdentifiers: [identifier(taskID)])
    }

    private func schedule(task: TaskItem, at date: Date) async {
        let content = UNMutableNotificationContent()
        content.title = "Task needs attention"
        content.body = task.title
        content.sound = .default
        content.userInfo = ["taskID": task.id.uuidString.lowercased()]

        let trigger = UNTimeIntervalNotificationTrigger(
            timeInterval: max(1, date.timeIntervalSinceNow),
            repeats: false
        )
        let request = UNNotificationRequest(
            identifier: identifier(task.id),
            content: content,
            trigger: trigger
        )
        do {
            try await center.add(request)
        } catch {
            // The server-backed alarm remains visible and can still notify through Web Push.
        }
    }

    private func identifier(_ taskID: UUID) -> String {
        "todo-trackr-task-alarm-\(taskID.uuidString.lowercased())"
    }
}
