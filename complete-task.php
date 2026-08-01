<?php
include 'db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

$id = $_POST['id'];
$userId = $_SESSION['user_id'];

$title = '';
$selectStmt = $conn->prepare("SELECT title FROM tasks WHERE id = ? AND user_id = ?");
$selectStmt->bind_param("ii", $id, $userId);
$selectStmt->execute();
$selectStmt->bind_result($title);
$selectStmt->fetch();
$selectStmt->close();

$stmt = $conn->prepare("UPDATE tasks SET status = 'completed', updated_at = NOW() WHERE id = ? AND user_id = ?");
$stmt->bind_param("ii", $id, $userId);
$stmt->execute();

$logStmt = $conn->prepare("INSERT INTO activity_log (task_id, user_id, action, action_label, message, created_at) VALUES (?, ?, 'complete', 'Completed', ?, NOW())");
$logMessage = "Task \"{$title}\" completed.";
$logStmt->bind_param("iis", $id, $userId, $logMessage);
$logStmt->execute();

echo json_encode(["success" => true, "message" => "Task completed!"]);
?>