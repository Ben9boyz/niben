<?php
// Spotify sends the browser back here after login (registered as the app's Redirect URI).
$_GET['action'] = 'spotify_callback';
require __DIR__ . '/api.php';
