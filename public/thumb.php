<?php
/**
 * Small versions of the trip photos, made on first request and kept on disk.
 *
 *   GET thumb.php?f=<name>.jpg&w=400|900
 *
 * The photo lists show these instead of the full 2400 px images; the full image is only loaded
 * when a photo is opened.
 */

declare(strict_types=1);

const THUMB_SIZES = [400, 900];

function bail(int $status): never {
    http_response_code($status);
    header('Cache-Control: no-store');
    exit;
}

$name = (string)($_GET['f'] ?? '');
$w = (int)($_GET['w'] ?? 400);
if (!preg_match('/^[a-f0-9]{20}\.jpg$/', $name) || !in_array($w, THUMB_SIZES, true)) bail(400);

$orig = __DIR__ . '/uploads/photos/' . $name;
$dir = __DIR__ . '/uploads/photos/thumbs/' . $w;
$thumb = $dir . '/' . $name;

if (!is_file($orig)) {
    // the photo was deleted – don't keep serving its small copy
    if (is_file($thumb)) @unlink($thumb);
    bail(404);
}

if (!is_file($thumb) || filemtime($thumb) < filemtime($orig)) {
    $info = @getimagesize($orig);
    $src = $info ? @imagecreatefromjpeg($orig) : false;
    if (!$src) bail(500);
    [$ow, $oh] = [$info[0], $info[1]];
    // the long edge becomes $w (never upscaled)
    $scale = min(1, $w / max($ow, $oh));
    $nw = max(1, (int)round($ow * $scale));
    $nh = max(1, (int)round($oh * $scale));
    $dst = imagecreatetruecolor($nw, $nh);
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $ow, $oh);
    if (!is_dir($dir)) @mkdir($dir, 0755, true);
    $tmp = $thumb . '.' . getmypid() . '.tmp';
    imagejpeg($dst, $tmp, 80);
    @rename($tmp, $thumb);
    imagedestroy($src);
    imagedestroy($dst);
}

header('Content-Type: image/jpeg');
header('Content-Length: ' . filesize($thumb));
header('Cache-Control: public, max-age=31536000, immutable');
header('X-Content-Type-Options: nosniff');
readfile($thumb);
