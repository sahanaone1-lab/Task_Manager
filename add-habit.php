<?php
header('Content-Type: application/json');
include 'db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

$userId = $_SESSION['user_id'];
$title = trim($_POST['title'] ?? '');
$description = trim($_POST['description'] ?? '');
$frequency = trim($_POST['frequency'] ?? 'Daily');

if (empty($title)) {
    echo json_encode(['success' => false, 'message' => 'Habit title is required']);
    exit;
}

$stmt = $conn->prepare("INSERT INTO habits (user_id, title, description, frequency, streak) VALUES (?, ?, ?, ?, 0)");
$stmt->bind_param("isss", $userId, $title, $description, $frequency);

if ($stmt->execute()) {
    $newId = $stmt->insert_id;
    
    // Log in activity_log
    $action = "add_habit";
    $label = "Habit Added";
    $msg = "Added habit: " . $title;
    $logStmt = $conn->prepare("INSERT INTO activity_log (user_id, action, action_label, message) VALUES (?, ?, ?, ?)");
    $logStmt->bind_param("isss", $userId, $action, $label, $msg);
    $logStmt->execute();
    $logStmt->close();
    
    echo json_encode(['success' => true, 'message' => 'Habit added successfully!', 'id' => $newId]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to add habit']);
}

$stmt->close();
?>
