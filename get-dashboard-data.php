<?php
/**
 * get-dashboard-data.php
 * Single API call that returns all data needed for the dashboard:
 *   - today's tasks, upcoming tasks, overdue tasks
 *   - today's habits, weekly/monthly habit progress
 *   - task completion %, habit completion %
 *   - recent activities (last 10)
 */
header('Content-Type: application/json');
include 'db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

$userId = (int)$_SESSION['user_id'];
$today  = date('Y-m-d');
$now    = date('Y-m-d H:i:s');

/* =====================================================================
   1. TASK STATS
   ===================================================================== */
$statsStmt = $conn->prepare(
    "SELECT
        COUNT(*) as total,
        SUM(status = 'completed') as completed,
        SUM(status = 'pending' OR status = 'in_progress') as pending,
        SUM(status NOT IN ('completed','trash','archived') AND due_date < ? AND due_date IS NOT NULL) as overdue
     FROM tasks
     WHERE user_id = ? AND status NOT IN ('trash','archived')"
);
$statsStmt->bind_param("si", $today, $userId);
$statsStmt->execute();
$stats = $statsStmt->get_result()->fetch_assoc();
$statsStmt->close();

$total     = (int)($stats['total'] ?? 0);
$completed = (int)($stats['completed'] ?? 0);
$pending   = (int)($stats['pending'] ?? 0);
$overdue   = (int)($stats['overdue'] ?? 0);
$taskCompletionPct = $total > 0 ? round(($completed / $total) * 100) : 0;

/* =====================================================================
   2. TODAY'S TASKS
   ===================================================================== */
$todayStmt = $conn->prepare(
    "SELECT id, title, priority, category, status, due_date, due_time
     FROM tasks
     WHERE user_id = ? AND due_date = ? AND status NOT IN ('trash','archived')
     ORDER BY priority DESC, due_time ASC
     LIMIT 10"
);
$todayStmt->bind_param("is", $userId, $today);
$todayStmt->execute();
$todayResult = $todayStmt->get_result();
$todayTasks = [];
while ($row = $todayResult->fetch_assoc()) {
    $todayTasks[] = $row;
}
$todayStmt->close();

/* =====================================================================
   3. UPCOMING TASKS (next 7 days, not today, not overdue)
   ===================================================================== */
$upcomingFrom = date('Y-m-d', strtotime('+1 day'));
$upcomingTo   = date('Y-m-d', strtotime('+7 days'));
$upcomingStmt = $conn->prepare(
    "SELECT id, title, priority, category, status, due_date, due_time
     FROM tasks
     WHERE user_id = ? AND due_date BETWEEN ? AND ? AND status NOT IN ('completed','trash','archived')
     ORDER BY due_date ASC, priority DESC
     LIMIT 10"
);
$upcomingStmt->bind_param("iss", $userId, $upcomingFrom, $upcomingTo);
$upcomingStmt->execute();
$upcomingResult = $upcomingStmt->get_result();
$upcomingTasks = [];
while ($row = $upcomingResult->fetch_assoc()) {
    $upcomingTasks[] = $row;
}
$upcomingStmt->close();

/* =====================================================================
   4. OVERDUE TASKS
   ===================================================================== */
$overdueStmt = $conn->prepare(
    "SELECT id, title, priority, category, status, due_date
     FROM tasks
     WHERE user_id = ? AND due_date < ? AND status NOT IN ('completed','trash','archived')
     ORDER BY due_date ASC
     LIMIT 8"
);
$overdueStmt->bind_param("is", $userId, $today);
$overdueStmt->execute();
$overdueResult = $overdueStmt->get_result();
$overdueTasks = [];
while ($row = $overdueResult->fetch_assoc()) {
    $overdueTasks[] = $row;
}
$overdueStmt->close();

/* =====================================================================
   5. HABIT STATS
   ===================================================================== */
$habitsStmt = $conn->prepare("SELECT * FROM habits WHERE user_id = ? ORDER BY id ASC");
$habitsStmt->bind_param("i", $userId);
$habitsStmt->execute();
$habitsResult = $habitsStmt->get_result();

$todayHabits       = [];
$totalHabits       = 0;
$completedTodayHabits = 0;
$weeklyHabitDone   = 0;
$weeklyHabitTotal  = 0;
$monthlyHabitDone  = 0;
$monthlyHabitTotal = 0;

$currentMonth = (int)date('n');
$currentYear  = (int)date('Y');
$currentDay   = (int)date('j');
$daysInMonth  = (int)date('t');

// Rolling 7 days
$rollingDates = [];
for ($i = 6; $i >= 0; $i--) {
    $rollingDates[] = date('Y-m-d', strtotime("-$i days"));
}

while ($habit = $habitsResult->fetch_assoc()) {
    $habitId = (int)$habit['id'];
    $totalHabits++;

    // Today completed?
    $ts = $conn->prepare("SELECT COUNT(*) as c FROM habit_logs WHERE habit_id = ? AND completed_date = ?");
    $ts->bind_param("is", $habitId, $today);
    $ts->execute();
    $tr = $ts->get_result()->fetch_assoc();
    $completedToday = (bool)($tr['c'] > 0);
    $ts->close();

    if ($completedToday) $completedTodayHabits++;

    $todayHabits[] = [
        'id'             => $habitId,
        'title'          => $habit['title'],
        'description'    => $habit['description'],
        'frequency'      => $habit['frequency'],
        'streak'         => (int)$habit['streak'],
        'completed_today' => $completedToday,
    ];

    // Weekly progress (last 7 days)
    foreach ($rollingDates as $d) {
        $weeklyHabitTotal++;
        $ws = $conn->prepare("SELECT COUNT(*) as c FROM habit_logs WHERE habit_id = ? AND completed_date = ?");
        $ws->bind_param("is", $habitId, $d);
        $ws->execute();
        $wr = $ws->get_result()->fetch_assoc();
        if ($wr['c'] > 0) $weeklyHabitDone++;
        $ws->close();
    }

    // Monthly progress (days 1..today in this month)
    $monthStart = sprintf('%04d-%02d-01', $currentYear, $currentMonth);
    $monthEnd   = $today;
    $monthlyHabitTotal += $currentDay;
    $ms = $conn->prepare(
        "SELECT COUNT(*) as c FROM habit_logs WHERE habit_id = ? AND completed_date BETWEEN ? AND ?"
    );
    $ms->bind_param("iss", $habitId, $monthStart, $monthEnd);
    $ms->execute();
    $mr = $ms->get_result()->fetch_assoc();
    $monthlyHabitDone += (int)$mr['c'];
    $ms->close();
}
$habitsStmt->close();

$habitCompletionPct = $totalHabits > 0 ? round(($completedTodayHabits / $totalHabits) * 100) : 0;
$weeklyHabitPct     = $weeklyHabitTotal > 0 ? round(($weeklyHabitDone / $weeklyHabitTotal) * 100) : 0;
$monthlyHabitPct    = $monthlyHabitTotal > 0 ? round(($monthlyHabitDone / $monthlyHabitTotal) * 100) : 0;

/* =====================================================================
   6. RECENT ACTIVITIES (last 10)
   ===================================================================== */
$actStmt = $conn->prepare(
    "SELECT action, action_label, message, created_at
     FROM activity_log
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 10"
);
$actStmt->bind_param("i", $userId);
$actStmt->execute();
$actResult = $actStmt->get_result();
$activities = [];
while ($row = $actResult->fetch_assoc()) {
    $activities[] = $row;
}
$actStmt->close();

/* =====================================================================
   RESPONSE
   ===================================================================== */
echo json_encode([
    'success'             => true,
    'task_stats'          => [
        'total'            => $total,
        'completed'        => $completed,
        'pending'          => $pending,
        'overdue'          => $overdue,
        'completion_pct'   => $taskCompletionPct,
    ],
    'today_tasks'         => $todayTasks,
    'upcoming_tasks'      => $upcomingTasks,
    'overdue_tasks'       => $overdueTasks,
    'today_habits'        => $todayHabits,
    'habit_stats'         => [
        'total'            => $totalHabits,
        'completed_today'  => $completedTodayHabits,
        'completion_pct'   => $habitCompletionPct,
        'weekly_pct'       => $weeklyHabitPct,
        'monthly_pct'      => $monthlyHabitPct,
    ],
    'activities'          => $activities,
    'today'               => $today,
]);
?>
