<?php
header('Content-Type: application/json');
include 'db.php';

$userId = check_auth();

$stmt = $conn->prepare("SELECT id, name, email, phone, bio, avatar, theme_preference, accent_color, language, notify_browser, notify_reminders, created_at FROM users WHERE id = ?");
$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();

if (!$user) {
    json_reply(['success' => false, 'message' => 'User profile not found'], 404);
}

// Remove sensitive info just in case
unset($user['password']);

json_reply(['success' => true, 'profile' => $user]);
?>