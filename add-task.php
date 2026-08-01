<?php
header('Content-Type: application/json');
include 'db.php';

$userId = check_auth();

$title = trim($_POST['title'] ?? '');
$description = trim($_POST['description'] ?? '');
$priority = $_POST['priority'] ?? 'Medium';
$dueDate = !empty($_POST['due_date']) ? $_POST['due_date'] : null;
$dueTime = !empty($_POST['due_time']) ? $_POST['due_time'] : null;
$category = $_POST['category'] ?? 'General';
$estimatedTime = isset($_POST['estimated_time']) ? (int)$_POST['estimated_time'] : 0;
$recurring = $_POST['recurring'] ?? 'none';
$dependsOn = !empty($_POST['depends_on']) ? (int)$_POST['depends_on'] : null;
$notes = trim($_POST['notes'] ?? '');
$isFavorite = isset($_POST['is_favorite']) && $_POST['is_favorite'] == '1' ? 1 : 0;
$subtasksInput = $_POST['subtasks'] ?? null;

if (empty($title)) {
    json_reply(["success" => false, "message" => "Task title is required!"], 400);
}

// Auto-detect priority if set to Auto/Empty
if (empty($priority) || $priority === 'Auto') {
    $lower = strtolower($title . ' ' . $description);
    if (strpos($lower, 'urgent') !== false || strpos($lower, 'asap') !== false || strpos($lower, 'critical') !== false || strpos($lower, 'exam') !== false || strpos($lower, 'interview') !== false) {
        $priority = 'High';
    } elseif (strpos($lower, 'low') !== false || strpos($lower, 'whenever') !== false || strpos($lower, 'casual') !== false) {
        $priority = 'Low';
    } else {
        $priority = 'Medium';
    }
}

// Auto-detect Category if General
if ($category === 'General') {
    $lower = strtolower($title . ' ' . $description);
    if (preg_match('/(code|bug|dev|git|deploy|api|app|frontend|backend|database|python|java|php|js)/i', $lower)) {
        $category = 'Coding';
    } elseif (preg_match('/(study|exam|homework|quiz|lecture|college|chapter|math|physics|notes)/i', $lower)) {
        $category = 'Study';
    } elseif (preg_match('/(meet|zoom|call|sync|presentation|standup|client)/i', $lower)) {
        $category = 'Meetings';
    } elseif (preg_match('/(buy|shop|store|cart|groceries|order)/i', $lower)) {
        $category = 'Shopping';
    } elseif (preg_match('/(gym|workout|run|walk|doctor|health|diet|meds)/i', $lower)) {
        $category = 'Health';
    } elseif (preg_match('/(pay|bill|bank|tax|invoice|finance|budget)/i', $lower)) {
        $category = 'Finance';
    } elseif (preg_match('/(project|work|report|office|client|task|sprint)/i', $lower)) {
        $category = 'Work';
    }
}

$conn->begin_transaction();

try {
    $stmt = $conn->prepare("
        INSERT INTO tasks 
        (user_id, title, task, description, priority, due_date, due_time, category, status, progress, estimated_time, actual_time, is_favorite, recurring, depends_on, notes, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, 0, ?, ?, ?, ?, NOW(), NOW())
    ");

    $stmt->bind_param(
        "isssssssiisis",
        $userId,
        $title,
        $title,
        $description,
        $priority,
        $dueDate,
        $dueTime,
        $category,
        $estimatedTime,
        $isFavorite,
        $recurring,
        $dependsOn,
        $notes
    );

    if (!$stmt->execute()) {
        throw new Exception("Failed to insert task.");
    }

    $taskId = $stmt->insert_id;

    // Handle Subtasks insertion
    $subtasksList = [];
    if (is_array($subtasksInput)) {
        $subtasksList = $subtasksInput;
    } elseif (is_string($subtasksInput) && !empty($subtasksInput)) {
        $decoded = json_decode($subtasksInput, true);
        if (is_array($decoded)) {
            $subtasksList = $decoded;
        }
    }

    if (!empty($subtasksList)) {
        $subStmt = $conn->prepare("INSERT INTO subtasks (task_id, user_id, title, completed, created_at) VALUES (?, ?, ?, ?, NOW())");
        foreach ($subtasksList as $subItem) {
            $subTitle = is_array($subItem) ? trim($subItem['title'] ?? '') : trim((string)$subItem);
            $subComp = is_array($subItem) && !empty($subItem['completed']) ? 1 : 0;
            if (!empty($subTitle)) {
                $subStmt->bind_param("iisi", $taskId, $userId, $subTitle, $subComp);
                $subStmt->execute();
            }
        }
    }

    // Activity Log
    $logStmt = $conn->prepare("INSERT INTO activity_log (task_id, user_id, action, action_label, message, created_at) VALUES (?, ?, 'create', 'Created', ?, NOW())");
    $logMessage = "Task \"{$title}\" added with priority {$priority}.";
    $logStmt->bind_param("iis", $taskId, $userId, $logMessage);
    $logStmt->execute();

    $conn->commit();

    json_reply([
        "success" => true,
        "message" => "Task created successfully!",
        "task_id" => $taskId,
        "category" => $category,
        "priority" => $priority
    ]);
} catch (Exception $e) {
    $conn->rollback();
    json_reply(["success" => false, "message" => "Error adding task: " . $e->getMessage()], 500);
}
?>