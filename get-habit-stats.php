<?php
/**
 * get-habit-stats.php
 * Returns statistics for all habits of the logged-in user:
 *   - current_streak, longest_streak, completion_pct, days_completed, missed_days
 *   - weekly_history (last 7 days)
 *   - monthly_history (for given month/year — map of date => bool)
 *
 * GET params:
 *   month (optional, default=current month)
 *   year  (optional, default=current year)
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

if ($month < 1 || $month > 12) $month = (int)date('n');
if ($year < 2000 || $year > 2099) $year = (int)date('Y');

$today      = date('Y-m-d');
$startDate  = sprintf('%04d-%02d-01', $year, $month);
$endDate    = date('Y-m-t', strtotime($startDate));

// Last 7 days (rolling window used by existing get-habits.php)
$rollingDates = [];
for ($i = 6; $i >= 0; $i--) {
    $rollingDates[] = date('Y-m-d', strtotime("-$i days"));
}

// Day labels for the rolling window
$dayLabels = [];
foreach ($rollingDates as $d) {
    $dayLabels[$d] = date('D', strtotime($d)); // Mon, Tue, ...
}

// Fetch all habits
$habitsStmt = $conn->prepare("SELECT * FROM habits WHERE user_id = ? ORDER BY id ASC");
$habitsStmt->bind_param("i", $userId);
$habitsStmt->execute();
$habitsResult = $habitsStmt->get_result();

$habits = [];

while ($habit = $habitsResult->fetch_assoc()) {
    $habitId = (int)$habit['id'];

    /* ---- Weekly history (rolling 7 days) ---- */
    $weeklyHistory = [];
    foreach ($rollingDates as $d) {
        $s = $conn->prepare("SELECT COUNT(*) as c FROM habit_logs WHERE habit_id = ? AND completed_date = ?");
        $s->bind_param("is", $habitId, $d);
        $s->execute();
        $r = $s->get_result()->fetch_assoc();
        $weeklyHistory[$d] = (bool)($r['c'] > 0);
        $s->close();
    }

    /* ---- Monthly history ---- */
    $monthlyHistory = [];
    // Build map of all days in the month
    $daysInMonth = (int)date('t', strtotime($startDate));
    for ($day = 1; $day <= $daysInMonth; $day++) {
        $dateKey = sprintf('%04d-%02d-%02d', $year, $month, $day);
        $monthlyHistory[$dateKey] = false;
    }
    // Fill from DB
    $ms = $conn->prepare(
        "SELECT completed_date FROM habit_logs WHERE habit_id = ? AND completed_date BETWEEN ? AND ?"
    );
    $ms->bind_param("iss", $habitId, $startDate, $endDate);
    $ms->execute();
    $mr = $ms->get_result();
    while ($mrow = $mr->fetch_assoc()) {
        $monthlyHistory[$mrow['completed_date']] = true;
    }
    $ms->close();

    /* ---- All-time stats ---- */
    $allStmt = $conn->prepare(
        "SELECT completed_date FROM habit_logs WHERE habit_id = ? ORDER BY completed_date ASC"
    );
    $allStmt->bind_param("i", $habitId);
    $allStmt->execute();
    $allResult = $allStmt->get_result();
    $allDates = [];
    while ($ar = $allResult->fetch_assoc()) {
        $allDates[] = $ar['completed_date'];
    }
    $allStmt->close();

    $daysCompleted = count($allDates);

    // Longest streak
    $longestStreak = 0;
    $tempStreak    = 0;
    $prevDate      = null;
    foreach ($allDates as $d) {
        if ($prevDate === null) {
            $tempStreak = 1;
        } else {
            $diff = (int)round((strtotime($d) - strtotime($prevDate)) / 86400);
            if ($diff === 1) {
                $tempStreak++;
            } else {
                $tempStreak = 1;
            }
        }
        if ($tempStreak > $longestStreak) $longestStreak = $tempStreak;
        $prevDate = $d;
    }

    // Days since habit was created (for missed days / completion %)
    $createdAt   = $habit['created_at'] ?? $startDate;
    $createdDate = date('Y-m-d', strtotime($createdAt));
    $daysSinceCreation = max(1, (int)round((strtotime($today) - strtotime($createdDate)) / 86400) + 1);
    $missedDays  = max(0, $daysSinceCreation - $daysCompleted);
    $completionPct = round(($daysCompleted / $daysSinceCreation) * 100);

    // Weekly completion (out of last 7 days)
    $weeklyDone = count(array_filter($weeklyHistory));
    $weeklyPct  = round(($weeklyDone / 7) * 100);

    // Monthly completion
    $monthlyDone  = count(array_filter($monthlyHistory));
    $monthlyTotal = $daysInMonth;
    // Only count up to today if we're in the current month
    if ($year == date('Y') && $month == date('n')) {
        $monthlyTotal = (int)date('j'); // day of month
    }
    $monthlyPct = $monthlyTotal > 0 ? round(($monthlyDone / $monthlyTotal) * 100) : 0;

    // Today completed
    $todayDone = $weeklyHistory[$today] ?? false;

    $habits[] = [
        'id'                => $habitId,
        'title'             => $habit['title'],
        'description'       => $habit['description'],
        'frequency'         => $habit['frequency'],
        'created_at'        => $habit['created_at'],
        'streak'            => (int)$habit['streak'],
        'current_streak'    => (int)$habit['streak'],
        'longest_streak'    => $longestStreak,
        'days_completed'    => $daysCompleted,
        'missed_days'       => $missedDays,
        'completion_pct'    => $completionPct,
        'weekly_history'    => $weeklyHistory,
        'monthly_history'   => $monthlyHistory,
        'weekly_pct'        => $weeklyPct,
        'monthly_pct'       => $monthlyPct,
        'completed_today'   => $todayDone,
        'days_in_month'     => $daysInMonth,
        'month'             => $month,
        'year'              => $year,
        'day_labels'        => $dayLabels,
        'rolling_dates'     => $rollingDates,
    ];
}

$habitsStmt->close();

// Summary stats across all habits
$totalHabits      = count($habits);
$completedToday   = count(array_filter($habits, fn($h) => $h['completed_today']));
$avgCompletionPct = $totalHabits > 0 ? round(array_sum(array_column($habits, 'completion_pct')) / $totalHabits) : 0;

echo json_encode([
    'success'           => true,
    'habits'            => $habits,
    'total_habits'      => $totalHabits,
    'completed_today'   => $completedToday,
    'avg_completion_pct' => $avgCompletionPct,
    'month'             => $month,
    'year'              => $year,
]);
?>
