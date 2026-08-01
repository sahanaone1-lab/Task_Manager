<?php
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
ini_set('display_errors', 0);
error_reporting(E_ALL);

$host = "localhost";
$user = "root";
$password = "";
$database = "taskdb";
$socket = "/Applications/XAMPP/xamppfiles/var/mysql/mysql.sock";

$conn = @mysqli_connect($host, $user, $password, $database, null, $socket);
if (!$conn) {
    $conn = mysqli_connect($host, $user, $password, $database);
}

if (!$conn) {
    header('Content-Type: application/json');
    die(json_encode(["error" => "Database connection failed: " . mysqli_connect_error()]));
}

mysqli_set_charset($conn, "utf8mb4");

// Users Table
$conn->query("CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");

$conn->query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) DEFAULT NULL");
$conn->query("ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT DEFAULT NULL");
$conn->query("ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar LONGTEXT DEFAULT NULL");
$conn->query("ALTER TABLE users ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(20) DEFAULT 'light'");
$conn->query("ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT '#6366F1'");
$conn->query("ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT 'en'");
$conn->query("ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_browser TINYINT(1) DEFAULT 1");
$conn->query("ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_reminders TINYINT(1) DEFAULT 1");

// Tasks Table
$conn->query("CREATE TABLE IF NOT EXISTS tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    title VARCHAR(255) NOT NULL,
    task VARCHAR(255) DEFAULT NULL,
    description TEXT DEFAULT NULL,
    priority VARCHAR(20) DEFAULT 'Medium',
    due_date DATE DEFAULT NULL,
    due_time TIME DEFAULT NULL,
    category VARCHAR(50) DEFAULT 'General',
    status VARCHAR(20) DEFAULT 'pending',
    progress INT DEFAULT 0,
    estimated_time INT DEFAULT 0,
    actual_time INT DEFAULT 0,
    is_favorite TINYINT(1) DEFAULT 0,
    recurring VARCHAR(20) DEFAULT 'none',
    depends_on INT DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
)");

$conn->query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS user_id INT DEFAULT NULL");
$conn->query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title VARCHAR(255) NOT NULL DEFAULT ''");
$conn->query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS task VARCHAR(255) DEFAULT NULL");
$conn->query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT DEFAULT NULL");
$conn->query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'Medium'");
$conn->query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_date DATE DEFAULT NULL");
$conn->query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS due_time TIME DEFAULT NULL");
$conn->query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'General'");
$conn->query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending'");
$conn->query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress INT DEFAULT 0");
$conn->query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_time INT DEFAULT 0");
$conn->query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_time INT DEFAULT 0");
$conn->query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_favorite TINYINT(1) DEFAULT 0");
$conn->query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurring VARCHAR(20) DEFAULT 'none'");
$conn->query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS depends_on INT DEFAULT NULL");
$conn->query("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT NULL");

// Subtasks Table
$conn->query("CREATE TABLE IF NOT EXISTS subtasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    completed TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_subtasks_task (task_id),
    INDEX idx_subtasks_user (user_id)
)");

// Task Attachments Table
$conn->query("CREATE TABLE IF NOT EXISTS task_attachments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_attachments_task (task_id)
)");

// Task Templates Table
$conn->query("CREATE TABLE IF NOT EXISTS task_templates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    category VARCHAR(50) DEFAULT 'Work',
    priority VARCHAR(20) DEFAULT 'Medium',
    subtasks_json TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_templates_user (user_id)
)");

// Task Reminders Table
$conn->query("CREATE TABLE IF NOT EXISTS task_reminders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    task_id INT NOT NULL,
    user_id INT NOT NULL,
    remind_at DATETIME NOT NULL,
    is_sent TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_reminders_user (user_id)
)");

// Activity Log Table
$conn->query("CREATE TABLE IF NOT EXISTS activity_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL,
    task_id INT DEFAULT NULL,
    action VARCHAR(50) NOT NULL,
    action_label VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");

// Habits & Habit Logs
$conn->query("CREATE TABLE IF NOT EXISTS habits (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT NULL,
    frequency VARCHAR(50) DEFAULT 'Daily',
    streak INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)");

$conn->query("CREATE TABLE IF NOT EXISTS habit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    habit_id INT NOT NULL,
    completed_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_habit_date (habit_id, completed_date)
)");

// Safe Helper Functions
if (!function_exists('check_auth')) {
    function check_auth() {
        if (empty($_SESSION['user_id'])) {
            http_response_code(401);
            echo json_encode(['success' => false, 'message' => 'Unauthorized access. Please log in.']);
            exit;
        }
        return (int)$_SESSION['user_id'];
    }
}

if (!function_exists('json_reply')) {
    function json_reply($data, $code = 200) {
        http_response_code($code);
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }
}
?>