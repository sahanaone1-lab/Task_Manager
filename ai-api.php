<?php
header('Content-Type: application/json');
include 'db.php';

$userId = check_auth();

$action = $_POST['action'] ?? ($_GET['action'] ?? '');

switch ($action) {

    // 1. AI Task Generator
    case 'generate_task':
        $prompt = trim($_POST['prompt'] ?? '');
        if (empty($prompt)) {
            json_reply(["success" => false, "message" => "Please enter a prompt (e.g., 'ML project due next week')"], 400);
        }

        $lower = strtolower($prompt);
        $title = ucfirst($prompt);
        $category = 'Work';
        $priority = 'Medium';
        $subtasks = [];
        $suggestedDays = 7;

        // Pattern matching for domain-specific subtask generation
        if (strpos($lower, 'ml') !== false || strpos($lower, 'machine learning') !== false || strpos($lower, 'ai model') !== false) {
            $title = "Machine Learning Project";
            $category = "Coding";
            $priority = "High";
            $subtasks = [
                "Research & Literature Review",
                "Dataset Collection & Preprocessing",
                "Model Architecture & Training",
                "Model Evaluation & Hyperparameter Testing",
                "Documentation & Code Refactoring",
                "Final Presentation & Report Preparation"
            ];
            $suggestedDays = 7;
        } elseif (strpos($lower, 'web') !== false || strpos($lower, 'website') !== false || strpos($lower, 'app') !== false || strpos($lower, 'full stack') !== false) {
            $title = "Full Stack Web Application";
            $category = "Coding";
            $priority = "High";
            $subtasks = [
                "Requirements & UI/UX Wireframing",
                "Database Schema Design & Setup",
                "Backend API Endpoints Development",
                "Frontend Component Implementation",
                "Testing & Bug Fixing",
                "Deployment to Server"
            ];
            $suggestedDays = 10;
        } elseif (strpos($lower, 'exam') !== false || strpos($lower, 'study') !== false || strpos($lower, 'test') !== false) {
            $title = "Exam Preparation & Revision";
            $category = "Study";
            $priority = "High";
            $subtasks = [
                "Gather Syllabus & Study Materials",
                "Review Lecture Notes & Summaries",
                "Solve Practice Questions & Past Papers",
                "Formula & Flashcard Memorization",
                "Mock Test Simulation"
            ];
            $suggestedDays = 5;
        } elseif (strpos($lower, 'presentation') !== false || strpos($lower, 'slides') !== false || strpos($lower, 'pitch') !== false) {
            $title = "Presentation Preparation";
            $category = "Meetings";
            $priority = "Medium";
            $subtasks = [
                "Outline Key Points & Deck Structure",
                "Design Slide Graphics & Visual Assets",
                "Draft Talking Points & Script",
                "Practice Timing & Speaking Delivery",
                "Review & Q&A Preparation"
            ];
            $suggestedDays = 3;
        } elseif (strpos($lower, 'gym') !== false || strpos($lower, 'fitness') !== false || strpos($lower, 'workout') !== false || strpos($lower, 'health') !== false) {
            $title = "Fitness & Wellness Goal";
            $category = "Health";
            $priority = "Medium";
            $subtasks = [
                "Set Daily Workout Routine",
                "Plan Balanced Meal & Nutrition Plan",
                "Track Water Intake & Sleep Patterns",
                "Weekly Progress Check-in"
            ];
            $suggestedDays = 14;
        } elseif (strpos($lower, 'trip') !== false || strpos($lower, 'travel') !== false || strpos($lower, 'vacation') !== false) {
            $title = "Travel & Trip Planning";
            $category = "Personal";
            $priority = "Medium";
            $subtasks = [
                "Book Transport & Hotel Accommodations",
                "Create Itinerary & Must-Visit List",
                "Pack Luggage & Essentials",
                "Check Travel Documents & Tickets"
            ];
            $suggestedDays = 7;
        } else {
            // General smart fallback breakdown
            $title = ucfirst($prompt);
            $subtasks = [
                "Initial Research & Planning",
                "Execution - Stage 1",
                "Execution - Stage 2",
                "Review & Quality Check",
                "Final Completion & Delivery"
            ];
        }

        // Smart deadline calculation
        $dueDate = date('Y-m-d', strtotime("+{$suggestedDays} days"));

        json_reply([
            "success" => true,
            "title" => $title,
            "category" => $category,
            "priority" => $priority,
            "due_date" => $dueDate,
            "subtasks" => $subtasks,
            "message" => "AI successfully generated task breakdown!"
        ]);
        break;

    // 2 & 3. AI Priority Detection & Smart Deadline Suggestion & Auto Categorization
    case 'analyze_task':
        $title = trim($_POST['title'] ?? '');
        $description = trim($_POST['description'] ?? '');
        $text = strtolower($title . ' ' . $description);

        // Priority logic
        $priority = 'Medium';
        if (preg_match('/(urgent|asap|today|tomorrow|critical|exam|interview|deadline|immediately)/i', $text)) {
            $priority = 'High';
        } elseif (preg_match('/(whenever|someday|low|casual|optional|minor|later)/i', $text)) {
            $priority = 'Low';
        }

        // Category logic
        $category = 'Work';
        if (preg_match('/(code|bug|dev|git|deploy|api|app|frontend|backend|database|python|java|php|js|html|css)/i', $text)) {
            $category = 'Coding';
        } elseif (preg_match('/(study|exam|homework|quiz|lecture|college|chapter|math|physics|notes|assignment)/i', $text)) {
            $category = 'Study';
        } elseif (preg_match('/(meet|zoom|call|sync|presentation|standup|client|interview)/i', $text)) {
            $category = 'Meetings';
        } elseif (preg_match('/(buy|shop|store|cart|groceries|order|purchase)/i', $text)) {
            $category = 'Shopping';
        } elseif (preg_match('/(gym|workout|run|walk|doctor|health|diet|meds|hospital)/i', $text)) {
            $category = 'Health';
        } elseif (preg_match('/(pay|bill|bank|tax|invoice|finance|budget|salary|money)/i', $text)) {
            $category = 'Finance';
        } elseif (preg_match('/(home|family|movie|clean|car|personal|vacation)/i', $text)) {
            $category = 'Personal';
        }

        // Deadline suggestion
        $days = ($priority === 'High') ? 2 : (($priority === 'Medium') ? 5 : 10);
        $suggestedDate = date('Y-m-d', strtotime("+{$days} days"));

        json_reply([
            "success" => true,
            "priority" => $priority,
            "category" => $category,
            "suggested_deadline" => $suggestedDate,
            "estimated_minutes" => ($priority === 'High') ? 120 : 60
        ]);
        break;

    // 4. AI Productivity Score & Focus Metric
    case 'get_productivity_score':
        $res = $conn->query("
            SELECT 
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
                SUM(CASE WHEN status IN ('pending', 'in_progress') THEN 1 ELSE 0 END) AS pending,
                SUM(CASE WHEN status IN ('pending', 'in_progress') AND due_date IS NOT NULL AND due_date < CURDATE() THEN 1 ELSE 0 END) AS overdue
            FROM tasks
            WHERE user_id = {$userId} AND status != 'trash'
        ")->fetch_assoc();

        $total = (int)$res['total'];
        $completed = (int)$res['completed'];
        $pending = (int)$res['pending'];
        $overdue = (int)$res['overdue'];

        $completionRate = ($total > 0) ? round(($completed / $total) * 100) : 0;
        $overduePenalty = min(30, $overdue * 10);
        $focusScore = max(0, min(100, round($completionRate * 0.8 + 20 - $overduePenalty)));
        $productivityScore = max(0, min(100, round($completionRate * 0.7 + (100 - ($overdue * 15)) * 0.3)));

        // Habit bonus
        $habitRes = $conn->query("SELECT COUNT(*) AS total_habits, SUM(streak) as total_streak FROM habits WHERE user_id = {$userId}")->fetch_assoc();
        $streakBonus = min(15, (int)($habitRes['total_streak'] ?? 0));
        $productivityScore = min(100, $productivityScore + $streakBonus);

        json_reply([
            "success" => true,
            "score" => $productivityScore,
            "focus_score" => $focusScore,
            "completion_rate" => $completionRate,
            "total_tasks" => $total,
            "completed_tasks" => $completed,
            "pending_tasks" => $pending,
            "overdue_tasks" => $overdue,
            "streak_bonus" => $streakBonus
        ]);
        break;

    // 5. AI Daily Summary & Smart Suggestions
    case 'get_daily_summary':
        $today = date('Y-m-d');

        // Today completed
        $compStmt = $conn->prepare("SELECT title, category FROM tasks WHERE user_id = ? AND status = 'completed' AND DATE(updated_at) = ?");
        $compStmt->bind_param("is", $userId, $today);
        $compStmt->execute();
        $completedToday = $compStmt->get_result()->fetch_all(MYSQLI_ASSOC);

        // Due today or pending
        $pendStmt = $conn->prepare("SELECT title, priority, category, due_date, estimated_time FROM tasks WHERE user_id = ? AND status IN ('pending', 'in_progress') AND status != 'trash' ORDER BY priority = 'High' DESC, due_date ASC LIMIT 5");
        $pendStmt->bind_param("i", $userId);
        $pendStmt->execute();
        $pendingTasks = $pendStmt->get_result()->fetch_all(MYSQLI_ASSOC);

        // Calculate estimated workload hours
        $totalMins = 0;
        foreach ($pendingTasks as $pt) {
            $totalMins += ($pt['estimated_time'] > 0) ? $pt['estimated_time'] : 45;
        }
        $estHours = round($totalMins / 60, 1);

        // Smart Suggestions
        $suggestions = [];
        $overdueCount = $conn->query("SELECT COUNT(*) as cnt FROM tasks WHERE user_id = {$userId} AND status IN ('pending', 'in_progress') AND due_date < CURDATE()")->fetch_assoc()['cnt'];

        if ($overdueCount > 0) {
            $suggestions[] = "You have {$overdueCount} overdue task(s). Focus on clearing high-priority overdue deliverables first.";
        }
        if (count($pendingTasks) > 6) {
            $suggestions[] = "Your workload today is heavy ({$estHours} hrs). Consider rescheduling non-critical tasks to tomorrow.";
        } else {
            $suggestions[] = "Workload is manageable! Use focused 25-minute Pomodoro sessions to maintain high momentum.";
        }

        json_reply([
            "success" => true,
            "date" => date('F j, Y'),
            "completed_today_count" => count($completedToday),
            "completed_today" => $completedToday,
            "pending_count" => count($pendingTasks),
            "pending_tasks" => $pendingTasks,
            "estimated_hours" => $estHours,
            "suggestions" => $suggestions
        ]);
        break;

    // 6. AI Weekly Report & Chart Data
    case 'get_weekly_report':
        // Last 7 days completion trend
        $days = [];
        $completionTrend = [];
        for ($i = 6; $i >= 0; $i--) {
            $d = date('Y-m-d', strtotime("-{$i} days"));
            $dayLabel = date('D', strtotime($d));
            $days[] = $dayLabel;

            $cnt = $conn->query("SELECT COUNT(*) AS c FROM tasks WHERE user_id = {$userId} AND status = 'completed' AND DATE(updated_at) = '{$d}'")->fetch_assoc()['c'];
            $completionTrend[] = (int)$cnt;
        }

        // Category distribution
        $catRes = $conn->query("SELECT category, COUNT(*) as count FROM tasks WHERE user_id = {$userId} AND status != 'trash' GROUP BY category");
        $categories = [];
        $catCounts = [];
        while ($row = $catRes->fetch_assoc()) {
            $categories[] = $row['category'];
            $catCounts[] = (int)$row['count'];
        }

        // Most productive day
        $maxIdx = array_keys($completionTrend, max($completionTrend))[0] ?? 0;
        $mostProductiveDay = $days[$maxIdx];

        json_reply([
            "success" => true,
            "labels" => $days,
            "trend_data" => $completionTrend,
            "categories" => $categories,
            "category_counts" => $catCounts,
            "most_productive_day" => $mostProductiveDay
        ]);
        break;

    // 9. AI Motivational Messages
    case 'get_motivational_quote':
        $quotes = [
            ["quote" => "Small daily improvements over time lead to stunning results.", "author" => "Robin Sharma"],
            ["quote" => "Focus on being productive instead of busy.", "author" => "Tim Ferriss"],
            ["quote" => "The secret of getting ahead is getting started.", "author" => "Mark Twain"],
            ["quote" => "Productivity is never an accident. It is always the result of a commitment to excellence.", "author" => "Paul J. Meyer"],
            ["quote" => "Done is better than perfect. Keep checking off your goals!", "author" => "Sheryl Sandberg"],
            ["quote" => "You don't need a new day to start over, you only need a new mindset.", "author" => "Anonymous"]
        ];
        $selected = $quotes[array_rand($quotes)];
        json_reply(["success" => true, "quote" => $selected['quote'], "author" => $selected['author']]);
        break;

    default:
        json_reply(["success" => false, "message" => "Invalid AI action requested."], 400);
        break;
}
?>
