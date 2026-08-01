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
$habitId = intval($_POST['id'] ?? 0);

if ($habitId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid Habit ID']);
    exit;
}

// Verify ownership
$checkStmt = $conn->prepare("SELECT title FROM habits WHERE id = ? AND user_id = ?");
$checkStmt->bind_param("ii", $habitId, $userId);
$checkStmt->execute();
$checkResult = $checkStmt->get_result();
if ($checkResult->num_rows === 0) {
    echo json_encode(['success' => false, 'message' => 'Habit not found']);
    exit;
}
$habit = $checkResult->fetch_assoc();
$habitTitle = $habit['title'];
$checkStmt->close();

// Delete logs first (foreign key or manual cascade)
$delLogs = $conn->prepare("DELETE FROM habit_logs WHERE habit_id = ?");
$delLogs->bind_param("i", $habitId);
$delLogs->execute();
$delLogs->close();

// Delete habit
$delHabit = $conn->prepare("DELETE FROM habits WHERE id = ? AND user_id = ?");
$delHabit->bind_param("ii", $habitId, $userId);

if ($delHabit->execute()) {
    // Log activity
    $action = "delete_habit";
    $label = "Habit Deleted";
    $msg = "Deleted habit: " . $habitTitle;
    $logStmt = $conn->prepare("INSERT INTO activity_log (user_id, action, action_label, message) VALUES (?, ?, ?, ?)");
    $logStmt->bind_param("isss", $userId, $action, $label, $msg);
    $logStmt->execute();
    $logStmt->close();
    
    echo json_encode(['success' => true, 'message' => 'Habit deleted successfully.']);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to delete habit.']);
}

$delHabit->close();
?>
