<?php
header('Content-Type: application/json');
include 'db.php';

$userId = check_auth();
$action = $_POST['action'] ?? 'update_full';

if ($action === 'update_avatar') {
    $avatar = trim($_POST['avatar'] ?? '');
    $stmt = $conn->prepare("UPDATE users SET avatar = ? WHERE id = ?");
    $stmt->bind_param("si", $avatar, $userId);
    if ($stmt->execute()) {
        $res = $conn->query("SELECT id, name, email, phone, bio, avatar, theme_preference, accent_color FROM users WHERE id = $userId");
        $user = $res->fetch_assoc();
        $_SESSION['user_name'] = $user['name'];
        json_reply(['success' => true, 'message' => 'Profile picture updated successfully.', 'user' => $user]);
    } else {
        json_reply(['success' => false, 'message' => 'Failed to update avatar.'], 500);
    }
}

if ($action === 'remove_avatar') {
    $stmt = $conn->prepare("UPDATE users SET avatar = '' WHERE id = ?");
    $stmt->bind_param("i", $userId);
    if ($stmt->execute()) {
        $res = $conn->query("SELECT id, name, email, phone, bio, avatar, theme_preference, accent_color FROM users WHERE id = $userId");
        $user = $res->fetch_assoc();
        json_reply(['success' => true, 'message' => 'Profile picture removed successfully.', 'user' => $user]);
    } else {
        json_reply(['success' => false, 'message' => 'Failed to remove avatar.'], 500);
    }
}

$name   = trim($_POST['name'] ?? '');
$email  = trim($_POST['email'] ?? '');
$phone  = trim($_POST['phone'] ?? '');
$bio    = trim($_POST['bio'] ?? '');
$avatar = trim($_POST['avatar'] ?? '');

if ($name === '') {
    json_reply(['success' => false, 'message' => 'Name is required.'], 400);
}

if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_reply(['success' => false, 'message' => 'Invalid email address.'], 400);
}

if ($email !== '') {
    $check = $conn->prepare("SELECT id FROM users WHERE email = ? AND id != ?");
    $check->bind_param("si", $email, $userId);
    $check->execute();
    $check->store_result();
    if ($check->num_rows > 0) {
        json_reply(['success' => false, 'message' => 'Email is already in use by another account.'], 400);
    }
}

// Fetch existing user to preserve avatar if not provided in full update
if (empty($avatar)) {
    $res = $conn->query("SELECT avatar FROM users WHERE id = $userId");
    if ($row = $res->fetch_assoc()) {
        $avatar = $row['avatar'] ?? '';
    }
}

$stmt = $conn->prepare("UPDATE users SET name = ?, email = ?, phone = ?, bio = ?, avatar = ? WHERE id = ?");
$stmt->bind_param("sssssi", $name, $email, $phone, $bio, $avatar, $userId);

if (!$stmt->execute()) {
    json_reply(['success' => false, 'message' => 'Database error during profile update.'], 500);
}

$_SESSION['user_name']  = $name;
$_SESSION['user_email'] = $email;

$res = $conn->query("SELECT id, name, email, phone, bio, avatar, theme_preference, accent_color FROM users WHERE id = $userId");
$user = $res->fetch_assoc();

json_reply(['success' => true, 'message' => 'Profile updated successfully.', 'user' => $user]);
?>