<?php
/**
 * get-calendar-tasks.php
 * Returns tasks grouped by due_date for a given month and year.
 * Used by the Calendar page to render task badges on date cells.
 */
header('Content-Type: application/json');
include 'db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

$userId = (int)$_SESSION['user_id'];
$month  = (int)($_GET['month'] ?? date('n'));
$year   = (int)($_GET['year']  ?? date('Y'));

// Clamp month/year
if ($month < 1 || $month > 12) $month = (int)date('n');
if ($year < 2000 || $year > 2099) $year = (int)date('Y');

$startDate = sprintf('%04d-%02d-01', $year, $month);
$endDate   = date('Y-m-t', strtotime($startDate)); // last day of month

// Fetch all tasks for this user in this month that have a due_date
$stmt = $conn->prepare(
    "SELECT id, title, priority, category, status, due_date, due_time
     FROM tasks
     WHERE user_id = ?
       AND due_date BETWEEN ? AND ?
       AND status NOT IN ('trash', 'archived')
     ORDER BY due_date ASC, priority DESC"
);
$stmt->bind_param("iss", $userId, $startDate, $endDate);
$stmt->execute();
$result = $stmt->get_result();

$tasksByDate = [];
$today = date('Y-m-d');

while ($row = $result->fetch_assoc()) {
    $date = $row['due_date'];
    if (!isset($tasksByDate[$date])) {
        $tasksByDate[$date] = [];
    }
    // Add overdue flag
    $row['is_overdue'] = ($row['status'] !== 'completed' && $date < $today);
    $tasksByDate[$date][] = $row;
}

$stmt->close();

echo json_encode([
    'success'      => true,
    'tasks_by_date' => $tasksByDate,
    'month'        => $month,
    'year'         => $year,
    'today'        => $today
]);
?>
