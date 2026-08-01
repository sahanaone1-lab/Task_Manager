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
$completedDate = trim($_POST['date'] ?? date('Y-m-d'));

if ($habitId <= 0) {
    echo json_encode(['success' => false, 'message' => 'Invalid Habit ID']);
    exit;
}

// Verify habit belongs to the user
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

// Check if log exists
$logStmt = $conn->prepare("SELECT id FROM habit_logs WHERE habit_id = ? AND completed_date = ?");
$logStmt->bind_param("is", $habitId, $completedDate);
$logStmt->execute();
$logResult = $logStmt->get_result();
$exists = $logResult->num_rows > 0;
$logStmt->close();

$completed = false;

if ($exists) {
    // Delete log
    $delStmt = $conn->prepare("DELETE FROM habit_logs WHERE habit_id = ? AND completed_date = ?");
    $delStmt->bind_param("is", $habitId, $completedDate);
    $delStmt->execute();
    $delStmt->close();
    $completed = false;
    $msg = "Unchecked habit: " . $habitTitle;
} else {
    // Insert log
    $insStmt = $conn->prepare("INSERT INTO habit_logs (habit_id, completed_date) VALUES (?, ?)");
    $insStmt->bind_param("is", $habitId, $completedDate);
    $insStmt->execute();
    $insStmt->close();
    $completed = true;
    $msg = "Completed habit: " . $habitTitle;
}

// Helper to update streak
$newStreak = updateHabitStreak($conn, $habitId);

// Log activity
$action = "toggle_habit";
$label = $completed ? "Habit Completed" : "Habit Uncompleted";
$logStmt = $conn->prepare("INSERT INTO activity_log (user_id, action, action_label, message) VALUES (?, ?, ?, ?)");
$logStmt->bind_param("isss", $userId, $action, $label, $msg);
$logStmt->execute();
$logStmt->close();

echo json_encode([
    'success' => true,
    'completed' => $completed,
    'streak' => $newStreak,
    'message' => $completed ? "Habit checked off!" : "Habit unchecked."
]);

// Streak calculation function
function updateHabitStreak($conn, $habitId) {
    $stmt = $conn->prepare("SELECT completed_date FROM habit_logs WHERE habit_id = ? ORDER BY completed_date DESC");
    $stmt->bind_param("i", $habitId);
    $stmt->execute();
    $result = $stmt->get_result();
    $dates = [];
    while ($row = $result->fetch_assoc()) {
        $dates[] = $row['completed_date'];
    }
    $stmt->close();
    
    if (empty($dates)) {
        $streak = 0;
    } else {
        $today = new DateTime('today');
        $yesterday = new DateTime('yesterday');
        
        $mostRecent = new DateTime($dates[0]);
        
        // If the most recent completion is before yesterday, streak is broken
        if ($mostRecent < $yesterday && $mostRecent->format('Y-m-d') !== $today->format('Y-m-d')) {
            $streak = 0;
        } else {
            $streak = 1;
            $currentDate = $mostRecent;
            
            for ($i = 1; $i < count($dates); $i++) {
                $nextDate = new DateTime($dates[$i]);
                $diff = $currentDate->diff($nextDate)->days;
                
                if ($diff === 1) {
                    $streak++;
                    $currentDate = $nextDate;
                } elseif ($diff === 0) {
                    continue;
                } else {
                    break;
                }
            }
        }
    }
    
    $updateStmt = $conn->prepare("UPDATE habits SET streak = ? WHERE id = ?");
    $updateStmt->bind_param("ii", $streak, $habitId);
    $updateStmt->execute();
    $updateStmt->close();
    return $streak;
}
?>
