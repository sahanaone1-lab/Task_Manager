<?php
header('Content-Type: application/json');
include 'db.php';

$email = trim($_POST['email'] ?? '');
$password = trim($_POST['password'] ?? '');

if (!$email || !$password) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email and password are required.']);
    exit;
}

$stmt = $conn->prepare("SELECT id, name, password FROM users WHERE email = ? LIMIT 1");
$stmt->bind_param("s", $email);
$stmt->execute();
$stmt->bind_result($userId, $name, $hash);
if (!$stmt->fetch() || !password_verify($password, $hash)) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Invalid email or password.']);
    exit;
}

$_SESSION['user_id'] = $userId;
$_SESSION['user_name'] = $name;
$_SESSION['user_email'] = $email;

echo json_encode(['success' => true, 'message' => 'Login successful.', 'user' => ['id' => $userId, 'name' => $name, 'email' => $email]]);
