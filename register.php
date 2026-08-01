<?php
header('Content-Type: application/json');
include 'db.php';

$name = trim($_POST['name'] ?? '');
$email = trim($_POST['email'] ?? '');
$password = trim($_POST['password'] ?? '');

if (!$name || !$email || !$password) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Name, email, and password are required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Email is invalid.']);
    exit;
}

$existing = $conn->prepare("SELECT id FROM users WHERE email = ?");
$existing->bind_param("s", $email);
$existing->execute();
$existing->store_result();
if ($existing->num_rows > 0) {
    http_response_code(409);
    echo json_encode(['success' => false, 'message' => 'Email is already registered.']);
    exit;
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = $conn->prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)");
$stmt->bind_param("sss", $name, $email, $hash);
$stmt->execute();
$userId = $conn->insert_id;

$_SESSION['user_id'] = $userId;
$_SESSION['user_name'] = $name;
$_SESSION['user_email'] = $email;

echo json_encode(['success' => true, 'message' => 'Registration successful.', 'user' => ['id' => $userId, 'name' => $name, 'email' => $email]]);
