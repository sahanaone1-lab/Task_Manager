<?php
include 'db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

$userId = $_SESSION['user_id'];
$completed = [];
$stmt = $conn->prepare("SELECT id, title FROM tasks WHERE status = 'completed' AND user_id = ?");
$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();
if ($result) {
    while ($row = $result->fetch_assoc()) {
        $completed[] = $row;
    }
}

$count = count($completed);
if ($count > 0) {
    $stmt = $conn->prepare("DELETE FROM tasks WHERE status = 'completed' AND user_id = ?");
    $stmt->bind_param("i", $userId);
    $stmt->execute();

    $message = "Cleared {$count} completed task" . ($count === 1 ? "" : "s") . ".";
    $logStmt = $conn->prepare("INSERT INTO activity_log (task_id, user_id, action, action_label, message, created_at) VALUES (NULL, ?, 'clear_completed', 'Cleared Completed', ?, NOW())");
    $logStmt->bind_param("is", $userId, $message);
    $logStmt->execute();
} else {
    $message = "No completed tasks to clear.";
}

echo json_encode(["success" => true, "message" => $message]);
