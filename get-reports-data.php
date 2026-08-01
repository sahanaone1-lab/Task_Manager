<?php
/**
 * get-reports-data.php
 * Returns comprehensive data for the Reports page:
 *   - Task stats (total, completed, pending, overdue)
 *   - Priority breakdown
 *   - Category breakdown
 *   - 7-day trend (completed tasks per day)
 *   - 30-day trend (completed tasks per day)
 *   - Habit completion stats
 *   - Weekly and monthly habit progress
 *   - Most productive day
 *   - CSV export data
 *
 * GET params:
 *   format=csv  → returns CSV file for download
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

/* =====================================================================
   1. OVERALL TASK STATS
   ===================================================================== */
$statsStmt = $conn->prepare(
    "SELECT
        COUNT(*) as total,
        SUM(status = 'completed') as completed,
        SUM(status IN ('pending','in_progress')) as pending,
        SUM(status NOT IN ('completed','trash','archived') AND due_date < ? AND due_date IS NOT NULL) as overdue
     FROM tasks
     WHERE user_id = ? AND status NOT IN ('trash','archived')"
);
$statsStmt->bind_param("si", $today, $userId);
$statsStmt->execute();
$stats = $statsStmt->get_result()->fetch_assoc();
$statsStmt->close();

$total     = (int)($stats['total']     ?? 0);
$completed = (int)($stats['completed'] ?? 0);
$pending   = (int)($stats['pending']   ?? 0);
$overdue   = (int)($stats['overdue']   ?? 0);
$completionPct = $total > 0 ? round(($completed / $total) * 100) : 0;

/* =====================================================================
   2. PRIORITY BREAKDOWN
   ===================================================================== */
$prioStmt = $conn->prepare(
    "SELECT priority, COUNT(*) as cnt
     FROM tasks
     WHERE user_id = ? AND status NOT IN ('trash','archived')
     GROUP BY priority ORDER BY FIELD(priority,'High','Medium','Low')"
);
$prioStmt->bind_param("i", $userId);
$prioStmt->execute();
$prioResult = $prioStmt->get_result();
$priorityLabels = [];
$priorityCounts = [];
while ($row = $prioResult->fetch_assoc()) {
    $priorityLabels[] = $row['priority'];
    $priorityCounts[] = (int)$row['cnt'];
}
$prioStmt->close();

/* =====================================================================
   3. CATEGORY BREAKDOWN
   ===================================================================== */
$catStmt = $conn->prepare(
    "SELECT category, COUNT(*) as cnt
     FROM tasks
     WHERE user_id = ? AND status NOT IN ('trash','archived')
     GROUP BY category ORDER BY cnt DESC LIMIT 8"
);
$catStmt->bind_param("i", $userId);
$catStmt->execute();
$catResult = $catStmt->get_result();
$categories      = [];
$categoryCounts  = [];
while ($row = $catResult->fetch_assoc()) {
    $categories[]     = $row['category'];
    $categoryCounts[] = (int)$row['cnt'];
}
$catStmt->close();

/* =====================================================================
   4. 7-DAY TREND (completed tasks per day)
   ===================================================================== */
$trendLabels = [];
$trendData   = [];
for ($i = 6; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime("-$i days"));
    $dayName = date('D', strtotime($d)); // Mon, Tue...
    $trendLabels[] = $dayName;
    $ts = $conn->prepare(
        "SELECT COUNT(*) as c FROM tasks
         WHERE user_id = ? AND status = 'completed' AND DATE(updated_at) = ?"
    );
    $ts->bind_param("is", $userId, $d);
    $ts->execute();
    $tr = $ts->get_result()->fetch_assoc();
    $trendData[] = (int)$tr['c'];
    $ts->close();
}

// Most productive day
$maxVal = max($trendData ?: [0]);
$maxIdx = array_search($maxVal, $trendData);
$mostProductiveDay = $maxVal > 0 ? $trendLabels[$maxIdx] : '--';

/* =====================================================================
   5. 30-DAY TREND
   ===================================================================== */
$monthTrendLabels = [];
$monthTrendData   = [];
for ($i = 29; $i >= 0; $i--) {
    $d = date('Y-m-d', strtotime("-$i days"));
    $monthTrendLabels[] = date('M j', strtotime($d));
    $ms = $conn->prepare(
        "SELECT COUNT(*) as c FROM tasks
         WHERE user_id = ? AND status = 'completed' AND DATE(updated_at) = ?"
    );
    $ms->bind_param("is", $userId, $d);
    $ms->execute();
    $mr = $ms->get_result()->fetch_assoc();
    $monthTrendData[] = (int)$mr['c'];
    $ms->close();
}

/* =====================================================================
   6. HABIT STATS
   ===================================================================== */
$habitsStmt = $conn->prepare("SELECT * FROM habits WHERE user_id = ? ORDER BY id ASC");
$habitsStmt->bind_param("i", $userId);
$habitsStmt->execute();
$habitsResult = $habitsStmt->get_result();

$habitRows = [];
$totalHabits       = 0;
$completedTodayH   = 0;
$totalWeeklySlots  = 0;
$weeklyDone        = 0;

// Rolling 7 days
$rollingDates = [];
for ($i = 6; $i >= 0; $i--) {
    $rollingDates[] = date('Y-m-d', strtotime("-$i days"));
}

while ($habit = $habitsResult->fetch_assoc()) {
    $hid = (int)$habit['id'];
    $totalHabits++;

    // Today?
    $ts = $conn->prepare("SELECT COUNT(*) as c FROM habit_logs WHERE habit_id = ? AND completed_date = ?");
    $ts->bind_param("is", $hid, $today);
    $ts->execute();
    $tr = $ts->get_result()->fetch_assoc();
    $doneToday = (bool)($tr['c'] > 0);
    $ts->close();
    if ($doneToday) $completedTodayH++;

    // Weekly
    $wDone = 0;
    foreach ($rollingDates as $d) {
        $totalWeeklySlots++;
        $ws = $conn->prepare("SELECT COUNT(*) as c FROM habit_logs WHERE habit_id = ? AND completed_date = ?");
        $ws->bind_param("is", $hid, $d);
        $ws->execute();
        $wr = $ws->get_result()->fetch_assoc();
        if ($wr['c'] > 0) { $weeklyDone++; $wDone++; }
        $ws->close();
    }

    // All-time completed
    $allS = $conn->prepare("SELECT COUNT(*) as c FROM habit_logs WHERE habit_id = ?");
    $allS->bind_param("i", $hid);
    $allS->execute();
    $allR = $allS->get_result()->fetch_assoc();
    $allS->close();

    $habitRows[] = [
        'title'          => $habit['title'],
        'streak'         => (int)$habit['streak'],
        'completed_today' => $doneToday,
        'days_completed' => (int)$allR['c'],
        'weekly_done'    => $wDone,
    ];
}
$habitsStmt->close();

$habitCompletionPct = $totalHabits > 0 ? round(($completedTodayH / $totalHabits) * 100) : 0;
$weeklyHabitPct     = $totalWeeklySlots > 0 ? round(($weeklyDone / $totalWeeklySlots) * 100) : 0;

/* =====================================================================
   7. CSV FORMAT
   ===================================================================== */
if (isset($_GET['format']) && $_GET['format'] === 'csv') {
    // Re-fetch tasks for CSV
    $csvStmt = $conn->prepare(
        "SELECT id, title, description, category, priority, status, due_date, created_at
         FROM tasks WHERE user_id = ? AND status NOT IN ('trash','archived') ORDER BY due_date DESC"
    );
    $csvStmt->bind_param("i", $userId);
    $csvStmt->execute();
    $csvResult = $csvStmt->get_result();

    // Flush JSON header — switch to CSV
    // Note: headers already sent (Content-Type: application/json), but we handle with JSON wrapper
    $csvRows = [['ID','Title','Description','Category','Priority','Status','Due Date','Created At']];
    while ($row = $csvResult->fetch_assoc()) {
        $csvRows[] = [
            $row['id'], $row['title'], $row['description'], $row['category'],
            $row['priority'], $row['status'], $row['due_date'], $row['created_at']
        ];
    }
    $csvStmt->close();

    // Encode CSV as base64 string in JSON response (client will trigger download)
    $csvOutput = '';
    foreach ($csvRows as $line) {
        $csvOutput .= implode(',', array_map(fn($v) => '"' . str_replace('"', '""', $v) . '"', $line)) . "\n";
    }

    echo json_encode([
        'success'  => true,
        'format'   => 'csv',
        'filename' => 'task-report-' . date('Y-m-d') . '.csv',
        'csv_data' => base64_encode($csvOutput),
    ]);
    exit;
}

/* =====================================================================
   RESPONSE
   ===================================================================== */
echo json_encode([
    'success'            => true,
    'task_stats'         => [
        'total'          => $total,
        'completed'      => $completed,
        'pending'        => $pending,
        'overdue'        => $overdue,
        'completion_pct' => $completionPct,
    ],
    'priority_labels'    => $priorityLabels,
    'priority_counts'    => $priorityCounts,
    'categories'         => $categories,
    'category_counts'    => $categoryCounts,
    'trend_labels'       => $trendLabels,
    'trend_data'         => $trendData,
    'month_trend_labels' => $monthTrendLabels,
    'month_trend_data'   => $monthTrendData,
    'most_productive_day' => $mostProductiveDay,
    'habit_stats'        => [
        'total'          => $totalHabits,
        'completed_today' => $completedTodayH,
        'completion_pct' => $habitCompletionPct,
        'weekly_pct'     => $weeklyHabitPct,
        'habits'         => $habitRows,
    ],
]);
?>
