<?php
header('Content-Type: application/json');
include 'db.php';

if (empty($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Not authenticated']);
    exit;
}

$userId = $_SESSION['user_id'];
$stmt = $conn->prepare("SELECT name, email, phone, bio, avatar FROM users WHERE id = ?");
$stmt->bind_param("i", $userId);
$stmt->execute();
$result = $stmt->get_result();
$user = $result->fetch_assoc();

if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'User not found']);
    exit;
}

echo json_encode([
    'success' => true,
    'user' => [
        'id' => $userId,
        'name' => $user['name'],
        'email' => $user['email'],
        'phone' => $user['phone'] ?? '',
        'bio' => $user['bio'] ?? '',
        'avatar' => $user['avatar'] ?? ''
    ]
]);
