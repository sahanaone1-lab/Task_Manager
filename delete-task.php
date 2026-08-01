<?php
header('Content-Type: application/json');
include 'db.php';

$userId = check_auth();

$id = isset($_POST['id']) ? (int)$_POST['id'] : (isset($_GET['id']) ? (int)$_GET['id'] : 0);
$mode = $_POST['mode'] ?? ($_GET['mode'] ?? 'trash'); // 'trash', 'restore', 'permanent'

if ($id <= 0) {
    json_reply(["success" => false, "message" => "Invalid task ID."], 400);
}

// Fetch task title for log
$stmt = $conn->prepare("SELECT title, status FROM tasks WHERE id = ? AND user_id = ?");
$stmt->bind_param("ii", $id, $userId);
$stmt->execute();
$task = $stmt->get_result()->fetch_assoc();

if (!$task) {
    json_reply(["success" => false, "message" => "Task not found."], 404);
}

$title = $task['title'];

if ($mode === 'permanent') {
    // Permanent deletion
    $delStmt = $conn->prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?");
    $delStmt->bind_param("ii", $id, $userId);
    $success = $delStmt->execute();

    if ($success) {
        // Clean subtasks & attachments
        $conn->query("DELETE FROM subtasks WHERE task_id = {$id}");
        $conn->query("DELETE FROM task_attachments WHERE task_id = {$id}");

        $logStmt = $conn->prepare("INSERT INTO activity_log (task_id, user_id, action, action_label, message, created_at) VALUES (NULL, ?, 'delete', 'Permanently Deleted', ?, NOW())");
        $logMessage = "Task \"{$title}\" was permanently deleted.";
        $logStmt->bind_param("is", $userId, $logMessage);
        $logStmt->execute();

        json_reply(["success" => true, "message" => "Task permanently deleted."]);
    }
} elseif ($mode === 'restore') {
    // Restore from trash or archive
    $resStmt = $conn->prepare("UPDATE tasks SET status = 'pending', updated_at = NOW() WHERE id = ? AND user_id = ?");
    $resStmt->bind_param("ii", $id, $userId);
    $success = $resStmt->execute();

    if ($success) {
        $logStmt = $conn->prepare("INSERT INTO activity_log (task_id, user_id, action, action_label, message, created_at) VALUES (?, ?, 'restore', 'Restored', ?, NOW())");
        $logMessage = "Task \"{$title}\" restored to pending.";
        $logStmt->bind_param("iis", $id, $userId, $logMessage);
        $logStmt->execute();

        json_reply(["success" => true, "message" => "Task restored successfully."]);
    }
} else {
    // Move to trash
    $trStmt = $conn->prepare("UPDATE tasks SET status = 'trash', updated_at = NOW() WHERE id = ? AND user_id = ?");
    $trStmt->bind_param("ii", $id, $userId);
    $success = $trStmt->execute();

    if ($success) {
        $logStmt = $conn->prepare("INSERT INTO activity_log (task_id, user_id, action, action_label, message, created_at) VALUES (?, ?, 'trash', 'Moved to Trash', ?, NOW())");
        $logMessage = "Task \"{$title}\" moved to trash.";
        $logStmt->bind_param("iis", $id, $userId, $logMessage);
        $logStmt->execute();

        json_reply(["success" => true, "message" => "Task moved to trash."]);
    }
}

json_reply(["success" => false, "message" => "Operation failed."], 500);
?>