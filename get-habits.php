<?php
header('Content-Type: application/json');
include 'db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

$userId = $_SESSION['user_id'];

// Get all habits for the user
$stmt = $conn->prepare("SELECT * FROM habits WHERE user_id = ? ORDER BY id DESC");
$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();
$habits = [];

$todayStr = date('Y-m-d');

// Helper to get dates of the last 7 days (including today)
$rollingDates = [];
for ($i = 6; $i >= 0; $i--) {
    $rollingDates[] = date('Y-m-d', strtotime("-$i days"));
}

while ($row = $result->fetch_assoc()) {
    $habitId = $row['id'];
    
    // Check if completed today
    $logStmt = $conn->prepare("SELECT COUNT(*) as completed FROM habit_logs WHERE habit_id = ? AND completed_date = ?");
    $logStmt->bind_param("is", $habitId, $todayStr);
    $logStmt->execute();
    $logResult = $logStmt->get_result()->fetch_assoc();
    $row['completed_today'] = $logResult['completed'] > 0;
    $logStmt->close();
    
    // Fetch weekly completion details (for the 7 days grid)
    $history = [];
    foreach ($rollingDates as $d) {
        $histStmt = $conn->prepare("SELECT COUNT(*) as completed FROM habit_logs WHERE habit_id = ? AND completed_date = ?");
        $histStmt->bind_param("is", $habitId, $d);
        $histStmt->execute();
        $histResult = $histStmt->get_result()->fetch_assoc();
        $history[$d] = $histResult['completed'] > 0;
        $histStmt->close();
    }
    $row['history'] = $history;
    
    $habits[] = $row;
}

$stmt->close();
echo json_encode($habits);
?>
