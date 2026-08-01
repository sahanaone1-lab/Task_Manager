<?php
header('Content-Type: application/json');
include 'db.php';

$userId = check_auth();

$action = $_POST['action'] ?? ($_GET['action'] ?? '');

switch ($action) {
    case 'toggle_favorite':
        $id = (int)($_POST['id'] ?? 0);
        if ($id <= 0) json_reply(["success" => false, "message" => "Invalid task ID."], 400);

        $stmt = $conn->prepare("UPDATE tasks SET is_favorite = NOT is_favorite WHERE id = ? AND user_id = ?");
        $stmt->bind_param("ii", $id, $userId);
        if ($stmt->execute()) {
            $favResult = $conn->query("SELECT is_favorite FROM tasks WHERE id = {$id}")->fetch_assoc();
            json_reply([
                "success" => true,
                "is_favorite" => (int)$favResult['is_favorite'],
                "message" => $favResult['is_favorite'] ? "Added to favorites!" : "Removed from favorites."
            ]);
        }
        break;

    case 'archive':
        $id = (int)($_POST['id'] ?? 0);
        if ($id <= 0) json_reply(["success" => false, "message" => "Invalid task ID."], 400);

        $stmt = $conn->prepare("UPDATE tasks SET status = 'archived' WHERE id = ? AND user_id = ?");
        $stmt->bind_param("ii", $id, $userId);
        if ($stmt->execute()) {
            json_reply(["success" => true, "message" => "Task archived."]);
        }
        break;

    case 'duplicate':
        $id = (int)($_POST['id'] ?? 0);
        if ($id <= 0) json_reply(["success" => false, "message" => "Invalid task ID."], 400);

        $stmt = $conn->prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?");
        $stmt->bind_param("ii", $id, $userId);
        $stmt->execute();
        $task = $stmt->get_result()->fetch_assoc();

        if (!$task) json_reply(["success" => false, "message" => "Task not found."], 404);

        $newTitle = $task['title'] . " (Copy)";
        $dupStmt = $conn->prepare("
            INSERT INTO tasks (user_id, title, task, description, priority, due_date, due_time, category, status, progress, estimated_time, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, NOW(), NOW())
        ");
        $dupStmt->bind_param(
            "isssssssis",
            $userId,
            $newTitle,
            $newTitle,
            $task['description'],
            $task['priority'],
            $task['due_date'],
            $task['due_time'],
            $task['category'],
            $task['estimated_time'],
            $task['notes']
        );

        if ($dupStmt->execute()) {
            $newId = $dupStmt->insert_id;
            // Duplicate subtasks if any
            $subStmt = $conn->prepare("SELECT title, completed FROM subtasks WHERE task_id = ?");
            $subStmt->bind_param("i", $id);
            $subStmt->execute();
            $subRes = $subStmt->get_result();
            
            $insSub = $conn->prepare("INSERT INTO subtasks (task_id, user_id, title, completed, created_at) VALUES (?, ?, ?, ?, NOW())");
            while ($subRow = $subRes->fetch_assoc()) {
                $insSub->bind_param("iisi", $newId, $userId, $subRow['title'], $subRow['completed']);
                $insSub->execute();
            }

            json_reply(["success" => true, "message" => "Task duplicated successfully!", "new_id" => $newId]);
        }
        break;

    case 'subtask_add':
        $taskId = (int)($_POST['task_id'] ?? 0);
        $subTitle = trim($_POST['title'] ?? '');
        if ($taskId <= 0 || empty($subTitle)) json_reply(["success" => false, "message" => "Task ID and subtask title required."], 400);

        $stmt = $conn->prepare("INSERT INTO subtasks (task_id, user_id, title, completed, created_at) VALUES (?, ?, ?, 0, NOW())");
        $stmt->bind_param("iis", $taskId, $userId, $subTitle);
        if ($stmt->execute()) {
            $subId = $stmt->insert_id;
            json_reply(["success" => true, "subtask_id" => $subId, "message" => "Subtask added."]);
        }
        break;

    case 'subtask_toggle':
        $subId = (int)($_POST['subtask_id'] ?? 0);
        if ($subId <= 0) json_reply(["success" => false, "message" => "Invalid subtask ID."], 400);

        $stmt = $conn->prepare("UPDATE subtasks SET completed = NOT completed WHERE id = ? AND user_id = ?");
        $stmt->bind_param("ii", $subId, $userId);
        if ($stmt->execute()) {
            // Update parent task progress % based on completed subtasks
            $taskQuery = $conn->query("SELECT task_id FROM subtasks WHERE id = {$subId}")->fetch_assoc();
            if ($taskQuery) {
                $pId = (int)$taskQuery['task_id'];
                $stats = $conn->query("SELECT COUNT(*) AS total, SUM(completed) AS done FROM subtasks WHERE task_id = {$pId}")->fetch_assoc();
                $pct = ($stats['total'] > 0) ? round(($stats['done'] / $stats['total']) * 100) : 0;
                $conn->query("UPDATE tasks SET progress = {$pct} WHERE id = {$pId}");
            }
            json_reply(["success" => true, "message" => "Subtask toggled."]);
        }
        break;

    case 'subtask_delete':
        $subId = (int)($_POST['subtask_id'] ?? 0);
        if ($subId <= 0) json_reply(["success" => false, "message" => "Invalid subtask ID."], 400);

        $stmt = $conn->prepare("DELETE FROM subtasks WHERE id = ? AND user_id = ?");
        $stmt->bind_param("ii", $subId, $userId);
        if ($stmt->execute()) {
            json_reply(["success" => true, "message" => "Subtask removed."]);
        }
        break;

    case 'save_template':
        $title = trim($_POST['title'] ?? '');
        $description = trim($_POST['description'] ?? '');
        $category = $_POST['category'] ?? 'Work';
        $priority = $_POST['priority'] ?? 'Medium';
        $subtasksJson = $_POST['subtasks_json'] ?? '[]';

        if (empty($title)) json_reply(["success" => false, "message" => "Template title required."], 400);

        $stmt = $conn->prepare("INSERT INTO task_templates (user_id, title, description, category, priority, subtasks_json, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())");
        $stmt->bind_param("isssss", $userId, $title, $description, $category, $priority, $subtasksJson);
        if ($stmt->execute()) {
            json_reply(["success" => true, "message" => "Task template saved!"]);
        }
        break;

    case 'get_templates':
        $stmt = $conn->prepare("SELECT * FROM task_templates WHERE user_id = ? ORDER BY id DESC");
        $stmt->bind_param("i", $userId);
        $stmt->execute();
        $res = $stmt->get_result();
        $templates = [];
        while ($row = $res->fetch_assoc()) {
            $row['subtasks'] = json_decode($row['subtasks_json'] ?? '[]', true) ?: [];
            $templates[] = $row;
        }
        json_reply(["success" => true, "templates" => $templates]);
        break;

    default:
        json_reply(["success" => false, "message" => "Unknown action specified."], 400);
        break;
}
?>
