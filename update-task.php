<?php
header('Content-Type: application/json');
include 'db.php';

$userId = check_auth();

$id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
$title = trim($_POST['title'] ?? '');
$description = trim($_POST['description'] ?? '');
$priority = $_POST['priority'] ?? 'Medium';
$dueDate = !empty($_POST['due_date']) ? $_POST['due_date'] : null;
$dueTime = !empty($_POST['due_time']) ? $_POST['due_time'] : null;
$category = $_POST['category'] ?? 'General';
$status = $_POST['status'] ?? 'pending';
$progress = isset($_POST['progress']) ? (int)$_POST['progress'] : 0;
$estimatedTime = isset($_POST['estimated_time']) ? (int)$_POST['estimated_time'] : 0;
$actualTime = isset($_POST['actual_time']) ? (int)$_POST['actual_time'] : 0;
$recurring = $_POST['recurring'] ?? 'none';
$dependsOn = !empty($_POST['depends_on']) ? (int)$_POST['depends_on'] : null;
$notes = trim($_POST['notes'] ?? '');
$isFavorite = isset($_POST['is_favorite']) ? (int)$_POST['is_favorite'] : 0;
$subtasksInput = $_POST['subtasks'] ?? null;

if ($id <= 0) {
    json_reply(["success" => false, "message" => "Invalid Task ID!"], 400);
}

if (empty($title)) {
    json_reply(["success" => false, "message" => "Task title is required!"], 400);
}

// Verify task belongs to user
$checkStmt = $conn->prepare("SELECT id, status FROM tasks WHERE id = ? AND user_id = ?");
$checkStmt->bind_param("ii", $id, $userId);
$checkStmt->execute();
$existing = $checkStmt->get_result()->fetch_assoc();

if (!$existing) {
    json_reply(["success" => false, "message" => "Task not found or access denied."], 404);
}

$conn->begin_transaction();

try {
    $stmt = $conn->prepare("
        UPDATE tasks 
        SET title = ?,
            task = ?,
            description = ?,
            priority = ?,
            due_date = ?,
            due_time = ?,
            category = ?,
            status = ?,
            progress = ?,
            estimated_time = ?,
            actual_time = ?,
            is_favorite = ?,
            recurring = ?,
            depends_on = ?,
            notes = ?,
            updated_at = NOW()
        WHERE id = ? AND user_id = ?
    ");

    $stmt->bind_param(
        "ssssssssiiiisiiii",
        $title,
        $title,
        $description,
        $priority,
        $dueDate,
        $dueTime,
        $category,
        $status,
        $progress,
        $estimatedTime,
        $actualTime,
        $isFavorite,
        $recurring,
        $dependsOn,
        $notes,
        $id,
        $userId
    );

    if (!$stmt->execute()) {
        throw new Exception("Failed to update task record.");
    }

    // Update subtasks if passed
    if ($subtasksInput !== null) {
        $subtasksList = [];
        if (is_array($subtasksInput)) {
            $subtasksList = $subtasksInput;
        } elseif (is_string($subtasksInput)) {
            $decoded = json_decode($subtasksInput, true);
            if (is_array($decoded)) {
                $subtasksList = $decoded;
            }
        }

        // Remove old subtasks and insert new list
        $delSub = $conn->prepare("DELETE FROM subtasks WHERE task_id = ? AND user_id = ?");
        $delSub->bind_param("ii", $id, $userId);
        $delSub->execute();

        if (!empty($subtasksList)) {
            $subStmt = $conn->prepare("INSERT INTO subtasks (task_id, user_id, title, completed, created_at) VALUES (?, ?, ?, ?, NOW())");
            foreach ($subtasksList as $subItem) {
                $subTitle = is_array($subItem) ? trim($subItem['title'] ?? '') : trim((string)$subItem);
                $subComp = is_array($subItem) && !empty($subItem['completed']) ? 1 : 0;
                if (!empty($subTitle)) {
                    $subStmt->bind_param("iisi", $id, $userId, $subTitle, $subComp);
                    $subStmt->execute();
                }
            }
        }
    }

    // Activity log
    $logStmt = $conn->prepare("INSERT INTO activity_log (task_id, user_id, action, action_label, message, created_at) VALUES (?, ?, 'update', 'Updated', ?, NOW())");
    $logMessage = "Task \"{$title}\" updated.";
    $logStmt->bind_param("iis", $id, $userId, $logMessage);
    $logStmt->execute();

    $conn->commit();

    json_reply(["success" => true, "message" => "Task updated successfully!"]);
} catch (Exception $e) {
    $conn->rollback();
    json_reply(["success" => false, "message" => "Error updating task: " . $e->getMessage()], 500);
}
?>
