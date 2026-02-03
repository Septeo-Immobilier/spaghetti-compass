<?php
/**
 * Fonctions utilitaires
 */

declare(strict_types=1);

namespace App\Utils;

use DateTime;

/**
 * Génère un identifiant unique
 */
function generateId(): string
{
    return 'id-' . bin2hex(random_bytes(8));
}

/**
 * Formate une date pour l'affichage
 */
function formatDate(DateTime $date, string $format = 'Y-m-d H:i:s'): string
{
    return $date->format($format);
}

/**
 * Valide une adresse email
 */
function validateEmail(string $email): bool
{
    return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
}

/**
 * Nettoie une chaîne pour l'affichage HTML
 */
function sanitize(string $input): string
{
    return htmlspecialchars($input, ENT_QUOTES, 'UTF-8');
}

/**
 * Vérifie si une chaîne est vide ou null
 */
function isEmpty(?string $value): bool
{
    return $value === null || trim($value) === '';
}

/**
 * Tronque une chaîne à une longueur maximale
 */
function truncate(string $text, int $maxLength, string $suffix = '...'): string
{
    if (strlen($text) <= $maxLength) {
        return $text;
    }

    return substr($text, 0, $maxLength - strlen($suffix)) . $suffix;
}
