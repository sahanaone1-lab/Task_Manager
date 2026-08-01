<?php
header('Content-Type: application/json');
include 'db.php';

$userId = check_auth();

$statusFilter = $_GET['status'] ?? 'all';
$categoryFilter = $_GET['category'] ?? 'all';
$priorityFilter = $_GET['priority'] ?? 'all';
$searchQuery = trim($_GET['search'] ?? '');
$isFavorite = isset($_GET['favorite']) && $_GET['favorite'] === '1';

// Base SQL query
$sql = "
    SELECT t.*, 
           dep.title AS dependency_title,
           (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id) AS total_subtasks,
           (SELECT COUNT(*) FROM subtasks s WHERE s.task_id = t.id AND s.completed = 1) AS completed_subtasks
    FROM tasks t
    LEFT JOIN tasks dep ON t.depends_on = dep.id
    WHERE t.user_id = ?
";

$types = "i";
$params = [$userId];

// Status Filter Logic
if ($isFavorite) {
    $sql .= " AND t.is_favorite = 1 AND t.status != 'trash'";
} elseif ($statusFilter === 'pending') {
    $sql .= " AND t.status IN ('pending', 'in_progress')";
} elseif ($statusFilter === 'in_progress') {
    $sql .= " AND t.status = 'in_progress'";
} elseif ($statusFilter === 'completed') {
    $sql .= " AND t.status = 'completed'";
} elseif ($statusFilter === 'archived') {
    $sql .= " AND t.status = 'archived'";
} elseif ($statusFilter === 'trash') {
    $sql .= " AND t.status = 'trash'";
} elseif ($statusFilter === 'overdue') {
    $sql .= " AND t.status IN ('pending', 'in_progress') AND t.due_date IS NOT NULL AND t.due_date < CURDATE()";
} else {
    // 'all' excludes trash by default unless requested
    $sql .= " AND t.status != 'trash' AND t.status != 'archived'";
}

// Category Filter
if ($categoryFilter !== 'all' && !empty($categoryFilter)) {
    $sql .= " AND t.category = ?";
    $types .= "s";
    $params[] = $categoryFilter;
}

// Priority Filter
if ($priorityFilter !== 'all' && !empty($priorityFilter)) {
    $sql .= " AND t.priority = ?";
    $types .= "s";
    $params[] = $priorityFilter;
}

// Search Query
if (!empty($searchQuery)) {
    $sql .= " AND (t.title LIKE ? OR t.description LIKE ? OR t.notes LIKE ? OR t.category LIKE ?)";
    $searchLike = "%" . $searchQuery . "%";
    $types .= "ssss";
    $params[] = $searchLike;
    $params[] = $searchLike;
    $params[] = $searchLike;
    $params[] = $searchLike;
}

// Ordering
$sql .= " ORDER BY 
    t.is_favorite DESC,
    t.status = 'completed',
    t.due_date IS NULL,
    t.due_date ASC,
    t.id DESC";

$stmt = $conn->prepare($sql);
$stmt->bind_param($types, ...$params);
$stmt->execute();

$result = $stmt->get_result();
$tasks = [];
$taskIds = [];

while ($row = $result->fetch_assoc()) {
    if (!isset($row['task']) || empty($row['task'])) {
        $row['task'] = $row['title'];
    }
    $row['subtasks'] = [];
    $row['attachments'] = [];
    $tasks[$row['id']] = $row;
    $taskIds[] = $row['id'];
}

// Fetch subtasks if tasks exist
if (!empty($taskIds)) {
    $inClause = implode(',', array_fill(0, count($taskIds), '?'));
    $subStmt = $conn->prepare("SELECT * FROM subtasks WHERE task_id IN ($inClause) ORDER BY id ASC");
    $subTypes = str_repeat('i', count($taskIds));
    $subStmt->bind_param($subTypes, ...$taskIds);
    $subStmt->execute();
    $subResult = $subStmt->get_result();

    while ($subRow = $subResult->fetch_assoc()) {
        if (isset($tasks[$subRow['task_id']])) {
            $tasks[$subRow['task_id']]['subtasks'][] = $subRow;
        }
    }

    // Attachments
    $attStmt = $conn->prepare("SELECT * FROM task_attachments WHERE task_id IN ($inClause) ORDER BY id ASC");
    $attStmt->bind_param($subTypes, ...$taskIds);
    $attStmt->execute();
    $attResult = $attStmt->get_result();

    while ($attRow = $attResult->fetch_assoc()) {
        if (isset($tasks[$attRow['task_id']])) {
            $tasks[$attRow['task_id']]['attachments'][] = $attRow;
        }
    }
}

json_reply(array_values($tasks));
?>