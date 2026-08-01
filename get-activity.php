<?php
include 'db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

$userId = $_SESSION['user_id'];
$stmt = $conn->prepare("SELECT id, task_id, action, action_label, message, created_at FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 12");
$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();
$activity = [];
while ($row = $result->fetch_assoc()) {
    $activity[] = $row;
}

echo json_encode($activity);
