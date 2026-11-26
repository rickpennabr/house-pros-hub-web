/**
 * Play the new-message chime (in-app banner, admin chat). Uses the shared audio context that the
 * first tap on the page unlocks; a fresh AudioContext made here would start muted by the browser.
 */
import { playMessageSound } from '@/lib/notifications/message-sound';

export function playNotificationSound(): void {
  playMessageSound();
}
