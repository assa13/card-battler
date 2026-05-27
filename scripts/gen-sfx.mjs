/**
 * Генератор звуковых эффектов через jsfxr
 * v2 — менее писклявые звуки: ниже частоты, noise+LPF, длиннее decay
 * Запуск: node scripts/gen-sfx.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { jsfxr } from 'jsfxr';

const { SoundEffect, Params } = jsfxr;
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '../public/assets/sfx');

function save(relPath, se) {
  const riff = se.generate();
  const base64 = riff.dataURI.split(',')[1];
  const buf = Buffer.from(base64, 'base64');
  const fullPath = join(OUT_DIR, relPath);
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, buf);
  console.log('✓', relPath);
}

function make(presetFn, overrides = {}) {
  const p = new Params();
  presetFn.call(p);
  Object.assign(p, overrides);
  return new SoundEffect(p);
}

// ============================================================
// UI  — приглушённые, без высоких свистов
// ============================================================

// Клик / разыгрывание карты — тупой шлепок
save('ui/click.wav', make(Params.prototype.hitHurt, {
  wave_type: 3,
  p_env_attack: 0,
  p_env_sustain: 0.04,
  p_env_punch: 0.35,
  p_env_decay: 0.18,
  p_base_freq: 0.22,
  p_freq_ramp: -0.15,
  p_lpf_freq: 0.35,
  p_lpf_resonance: 0.1,
  sound_vol: 0.45,
}));

// Hover — едва слышный мягкий тик
save('ui/hover.wav', make(Params.prototype.hitHurt, {
  wave_type: 3,
  p_env_attack: 0,
  p_env_sustain: 0.02,
  p_env_punch: 0.1,
  p_env_decay: 0.1,
  p_base_freq: 0.18,
  p_freq_ramp: 0,
  p_lpf_freq: 0.3,
  sound_vol: 0.2,
}));

// Раздача карты — шелест бумаги
save('ui/card_deal.wav', make(Params.prototype.hitHurt, {
  wave_type: 3,
  p_env_attack: 0,
  p_env_sustain: 0.06,
  p_env_punch: 0.2,
  p_env_decay: 0.28,
  p_base_freq: 0.2,
  p_freq_ramp: 0.1,
  p_lpf_freq: 0.45,
  p_lpf_ramp: -0.1,
  sound_vol: 0.38,
}));

// Карта в сброс — глухой шлепок
save('ui/card_discard.wav', make(Params.prototype.hitHurt, {
  wave_type: 3,
  p_env_attack: 0,
  p_env_sustain: 0.05,
  p_env_punch: 0.15,
  p_env_decay: 0.22,
  p_base_freq: 0.18,
  p_freq_ramp: -0.1,
  p_lpf_freq: 0.32,
  sound_vol: 0.3,
}));

// ============================================================
// COMBAT — тяжёлые, земные звуки
// ============================================================

// Лёгкий удар — сухой шлепок
save('combat/hit_light.wav', make(Params.prototype.hitHurt, {
  wave_type: 3,
  p_env_sustain: 0.08,
  p_env_punch: 0.45,
  p_env_decay: 0.22,
  p_base_freq: 0.28,
  p_freq_ramp: -0.22,
  p_lpf_freq: 0.4,
  p_lpf_ramp: -0.1,
  sound_vol: 0.6,
}));

// Тяжёлый удар — низкий взрыв
save('combat/hit_heavy.wav', make(Params.prototype.explosion, {
  wave_type: 3,
  p_env_sustain: 0.15,
  p_env_punch: 0.6,
  p_env_decay: 0.42,
  p_base_freq: 0.12,
  p_freq_ramp: -0.3,
  p_lpf_freq: 0.35,
  p_lpf_ramp: -0.25,
  p_lpf_resonance: 0.15,
  sound_vol: 0.7,
}));

// Магический удар — синусоида с вибрато, низкая
save('combat/hit_magic.wav', make(Params.prototype.laserShoot, {
  wave_type: 2,
  p_env_attack: 0.02,
  p_env_sustain: 0.18,
  p_env_punch: 0.35,
  p_env_decay: 0.35,
  p_base_freq: 0.22,
  p_freq_ramp: 0.1,
  p_vib_strength: 0.18,
  p_vib_speed: 0.3,
  p_lpf_freq: 0.65,
  sound_vol: 0.55,
}));

// Яд — булькающий низкий звук
save('combat/hit_poison.wav', make(Params.prototype.laserShoot, {
  wave_type: 2,
  p_env_attack: 0.04,
  p_env_sustain: 0.14,
  p_env_punch: 0.2,
  p_env_decay: 0.4,
  p_base_freq: 0.18,
  p_freq_ramp: -0.05,
  p_vib_strength: 0.25,
  p_vib_speed: 0.25,
  p_lpf_freq: 0.5,
  p_lpf_resonance: 0.2,
  sound_vol: 0.45,
}));

// Атака врага — глухой удар
save('combat/enemy_attack.wav', make(Params.prototype.hitHurt, {
  wave_type: 3,
  p_env_sustain: 0.1,
  p_env_punch: 0.5,
  p_env_decay: 0.3,
  p_base_freq: 0.25,
  p_freq_ramp: -0.3,
  p_lpf_freq: 0.38,
  sound_vol: 0.65,
}));

// Смерть врага — гулкий взрыв
save('combat/death.wav', make(Params.prototype.explosion, {
  wave_type: 3,
  p_env_sustain: 0.22,
  p_env_punch: 0.65,
  p_env_decay: 0.55,
  p_base_freq: 0.1,
  p_freq_ramp: -0.4,
  p_lpf_freq: 0.32,
  p_lpf_ramp: -0.3,
  sound_vol: 0.72,
}));

// ============================================================
// MAP
// ============================================================

// Клик по узлу — мягкий двойной тон
save('map/node_click.wav', make(Params.prototype.pickupCoin, {
  wave_type: 1,
  p_env_sustain: 0.06,
  p_env_punch: 0.25,
  p_env_decay: 0.28,
  p_base_freq: 0.28,
  p_freq_ramp: 0.08,
  p_arp_mod: 0.3,
  p_arp_speed: 0.5,
  p_lpf_freq: 0.7,
  sound_vol: 0.45,
}));

// Переход на этап
save('map/move.wav', make(Params.prototype.jump, {
  wave_type: 1,
  p_env_sustain: 0.07,
  p_env_punch: 0.2,
  p_env_decay: 0.3,
  p_base_freq: 0.25,
  p_freq_ramp: 0.18,
  p_lpf_freq: 0.6,
  sound_vol: 0.4,
}));

// ============================================================
// GAME
// ============================================================

// Level up — тёплый аккорд вверх
save('game/level_up.wav', make(Params.prototype.powerUp, {
  wave_type: 1,
  p_env_attack: 0.02,
  p_env_sustain: 0.28,
  p_env_punch: 0.45,
  p_env_decay: 0.55,
  p_base_freq: 0.2,
  p_freq_ramp: 0.35,
  p_arp_mod: 0.5,
  p_arp_speed: 0.6,
  p_lpf_freq: 0.75,
  sound_vol: 0.6,
}));

// Победа — торжественный аккорд
save('game/victory.wav', make(Params.prototype.powerUp, {
  wave_type: 1,
  p_env_attack: 0.02,
  p_env_sustain: 0.35,
  p_env_punch: 0.55,
  p_env_decay: 0.65,
  p_base_freq: 0.22,
  p_freq_ramp: 0.28,
  p_arp_mod: 0.45,
  p_arp_speed: 0.55,
  p_repeat_speed: 0.38,
  p_lpf_freq: 0.7,
  sound_vol: 0.65,
}));

// Поражение — тяжёлое нисходящее
save('game/gameover.wav', make(Params.prototype.explosion, {
  wave_type: 3,
  p_env_sustain: 0.3,
  p_env_punch: 0.35,
  p_env_decay: 0.8,
  p_base_freq: 0.25,
  p_freq_ramp: -0.45,
  p_lpf_freq: 0.42,
  p_lpf_ramp: -0.4,
  sound_vol: 0.68,
}));

// Восстановление маны — тихий мягкий шёпот
save('game/mana_restore.wav', make(Params.prototype.powerUp, {
  wave_type: 2,
  p_env_attack: 0.08,
  p_env_sustain: 0.15,
  p_env_punch: 0.25,
  p_env_decay: 0.38,
  p_base_freq: 0.22,
  p_freq_ramp: 0.15,
  p_vib_strength: 0.1,
  p_vib_speed: 0.3,
  p_lpf_freq: 0.6,
  sound_vol: 0.38,
}));

// XP — монетка, низкая
save('game/xp_gain.wav', make(Params.prototype.pickupCoin, {
  wave_type: 1,
  p_env_sustain: 0.05,
  p_env_punch: 0.3,
  p_env_decay: 0.22,
  p_base_freq: 0.3,
  p_freq_ramp: 0.15,
  p_lpf_freq: 0.65,
  sound_vol: 0.38,
}));

// Ход врага — угрожающий низкий тон
save('game/enemy_turn.wav', make(Params.prototype.hitHurt, {
  wave_type: 1,
  p_env_sustain: 0.06,
  p_env_punch: 0.1,
  p_env_decay: 0.4,
  p_base_freq: 0.18,
  p_freq_ramp: -0.1,
  p_arp_mod: -0.3,
  p_arp_speed: 0.5,
  p_lpf_freq: 0.55,
  sound_vol: 0.5,
}));

// ============================================================
// EVENTS
// ============================================================

// Событие — мистический синус
save('events/event_start.wav', make(Params.prototype.powerUp, {
  wave_type: 2,
  p_env_attack: 0.12,
  p_env_sustain: 0.25,
  p_env_punch: 0.35,
  p_env_decay: 0.55,
  p_base_freq: 0.2,
  p_freq_ramp: 0.12,
  p_vib_strength: 0.22,
  p_vib_speed: 0.28,
  p_vib_delay: 0.15,
  p_lpf_freq: 0.7,
  sound_vol: 0.48,
}));

// Выбор усиления — тёплый аккорд
save('events/powerup_select.wav', make(Params.prototype.powerUp, {
  wave_type: 1,
  p_env_sustain: 0.22,
  p_env_punch: 0.5,
  p_env_decay: 0.5,
  p_base_freq: 0.24,
  p_freq_ramp: 0.35,
  p_arp_mod: 0.45,
  p_arp_speed: 0.58,
  p_lpf_freq: 0.72,
  sound_vol: 0.55,
}));

console.log('\nВсе звуки перегенерированы в public/assets/sfx/');
