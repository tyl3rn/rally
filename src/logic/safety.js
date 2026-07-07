// Rally safety logic — ported from gait-alerts.html.
// Pure functions only: every function takes a signal snapshot and returns data.
// This is the single source of truth the old demo never had (logic previously
// lived inline in the DOM script).
//
// A signal snapshot is: { gaitPct, proxDist, soundShiftType }
//   gaitPct        0–99   (% deviation from sober baseline)
//   proxDist       0–500  (meters from nearest rally member)
//   soundShiftType 'none' | 'gradual' | 'sudden'

export const DEMO = {
  TIME_LABEL: '1:52am',
  STATIONARY_MIN: 23,
  BATTERY_PCT: 85,
};

export const FRIENDS = [
  { ini: 'RD', name: 'Richard Do', color: '#355E3B', dist: 39 },
  { ini: 'CC', name: 'Collin Chan', color: '#355E3B', dist: 82 },
  { ini: 'SM', name: 'Sophia Ma', color: '#355E3B', dist: 113 },
  { ini: 'TN', name: 'Tyler Nguyen', color: '#7c3aed', dist: 188 },
];

export const ENV_INFO = {
  bar: { label: 'Loud venue, likely still at the bar', shift: 'none' },
  outside: { label: 'Outside / street, quieter than venue', shift: 'gradual' },
  quiet: { label: 'Very quiet, possibly somewhere alone', shift: 'sudden' },
  ride: { label: 'In a vehicle, likely heading home', shift: 'none' },
};

// ── Signal tier (drives banner, log, AI box color) ─────────────────────
export function getSignalTier({ gaitPct, proxDist, soundShiftType }) {
  if (gaitPct >= 95 || proxDist >= 500) return 'emergency';
  if (gaitPct >= 85 || proxDist >= 400) return 'urgent';
  if (gaitPct > 70 || soundShiftType === 'sudden') return 'urgent';
  if (gaitPct > 30 || proxDist > 100 || soundShiftType !== 'none') return 'heads-up';
  return null;
}

export function computeNarrativeScore({ gaitPct, proxDist, soundShiftType }) {
  const gaitPts = gaitPct > 70 ? 40 : gaitPct > 50 ? 25 : gaitPct > 30 ? 15 : 0;
  const soundPts = soundShiftType === 'sudden' ? 30 : soundShiftType === 'gradual' ? 10 : 0;
  const distPts = proxDist > 400 ? 30 : proxDist > 200 ? 20 : proxDist > 100 ? 10 : 0;
  const statPts = DEMO.STATIONARY_MIN >= 60 ? 20 : DEMO.STATIONARY_MIN >= 30 ? 10 : DEMO.STATIONARY_MIN >= 15 ? 5 : 0;
  const batPts = DEMO.BATTERY_PCT < 20 ? 10 : 0;
  return Math.min(100, Math.round((gaitPts + soundPts + distPts + statPts + batPts) * 1.2));
}

// ── AI analysis (hardcoded, context-aware — replaced by backend in step 2) ──
export function getAiContent(snapshot) {
  const { gaitPct, proxDist, soundShiftType } = snapshot;
  const N = 'Alex';
  const tier = getSignalTier(snapshot);
  const score = computeNarrativeScore(snapshot);

  const closeToGroup = proxDist <= 100;
  const farFromGroup = proxDist > 200;
  const gaitHigh = gaitPct > 70;
  const gaitMid = gaitPct > 50 && gaitPct <= 70;
  const gaitMild = gaitPct > 30 && gaitPct <= 50;
  const soundSudden = soundShiftType === 'sudden';
  const soundGradual = soundShiftType === 'gradual';

  let full = '';

  if (tier === 'emergency') {
    full = `${N}'s gait is ${gaitPct}% off baseline - I'd flag that alone, however what concerns me more is they're ${proxDist}m from the group${soundSudden ? ` and went completely quiet ${DEMO.STATIONARY_MIN} min ago` : ''}. But given it's ${DEMO.TIME_LABEL} and ${N} is usually home by now based on past rallies, this combination is hard to explain away. Score: ${score}. Go find them now.`;
  } else if (gaitHigh && soundSudden) {
    full = `${N}'s gait is ${gaitPct}% off their sober baseline - I think this is significant impairment, not just noise. However what adds real weight here is they went completely quiet near an unfamiliar spot ${DEMO.STATIONARY_MIN} min ago, which past rallies show is unusual for them. But given it's ${DEMO.TIME_LABEL}${farFromGroup ? ` and they're ${proxDist}m from the group` : " and they haven't moved since"}, these signals together are a serious flag. Score: ${score}. Check on ${N} now.`;
  } else if (gaitHigh && soundGradual) {
    full = `${N}'s gait is ${gaitPct}% off baseline - I'd normally wait for a second signal, however the gradual environment shift toward somewhere quieter suggests they may have left the venue area. But given they've been stationary for ${DEMO.STATIONARY_MIN} min at ${DEMO.TIME_LABEL}${farFromGroup ? ` and are ${proxDist}m from the group` : ''}, I think this warrants a check-in. Score: ${score}. Check on ${N}.`;
  } else if (gaitHigh && farFromGroup) {
    full = `${N}'s gait is ${gaitPct}% off their sober baseline. I'd consider this borderline on its own, however they're also ${proxDist}m from the nearest friend - further than their usual range based on past rallies. But given it's ${DEMO.TIME_LABEL} and ${N} has been in the same spot for ${DEMO.STATIONARY_MIN} min, the combination here is concerning. Score: ${score}. Check on ${N} now.`;
  } else if (gaitHigh && closeToGroup) {
    full = `${N}'s gait is ${gaitPct}% off their sober baseline - I think this reflects real impairment. However, they're still close to the group at ${proxDist}m, which is reassuring. But given it's ${DEMO.TIME_LABEL} and they've been stationary ${DEMO.STATIONARY_MIN} min, I'd still have someone check on them in person rather than just pinging. Score: ${score}. Check on ${N}.`;
  } else if (gaitMid && soundSudden) {
    full = `${N}'s gait has shifted ${gaitPct}% from baseline - moderate, not extreme. However they also went completely quiet ${DEMO.STATIONARY_MIN} min ago, which is the part I'm more unsure about. But given that past rallies show ${N} usually stays loud until heading home, this silence at ${DEMO.TIME_LABEL} feels off. Score: ${score}. Worth a check-in.`;
  } else if (soundSudden && farFromGroup) {
    full = `${N} went suddenly quiet near an unfamiliar spot ${DEMO.STATIONARY_MIN} min ago - I think that alone is worth noting. However gait looks okay at ${gaitPct}%, so this could just be a ride home. But given they're ${proxDist}m from the group at ${DEMO.TIME_LABEL} with no contact, I can't rule out something being wrong. Score: ${score}. Reach out to ${N}.`;
  } else if (soundSudden) {
    full = `${N} went from a loud venue to completely quiet ${DEMO.STATIONARY_MIN} min ago - I think this is the most interesting signal right now. However their gait is only ${gaitPct}% off and they're ${proxDist}m from the group, so it could just be a car or a quiet area. But given ${N} doesn't usually go quiet this early based on past rallies, I'd send a quick ping to confirm they're okay. Score: ${score}. Ping ${N}.`;
  } else if (gaitMid) {
    full = `${N}'s gait has drifted ${gaitPct}% from their sober baseline - I think this is worth watching but not alarming yet. However they're ${closeToGroup ? 'still close to the group' : proxDist + 'm from the group'} and the environment is consistent, which are both good signs. But given it's ${DEMO.TIME_LABEL} and they've been stationary ${DEMO.STATIONARY_MIN} min, I'd keep a closer eye over the next few minutes. Score: ${score}. Monitor ${N}.`;
  } else if (gaitMild) {
    full = `${N}'s gait shows a ${gaitPct}% deviation from baseline - I'd call this mild and possibly just movement variation. However it's crossed the flagging threshold, so I'm tracking it. But given they're close to the group and the environment is stable, I think this is low concern for now. Score: ${score}. Keeping an eye on ${N}.`;
  } else if (farFromGroup) {
    full = `${N} is ${proxDist}m from the group - I think that's further than usual for this point in the night. However gait looks steady and there's no sound shift, which makes this feel more like they wandered off than something wrong. But given it's ${DEMO.TIME_LABEL}, I'd send a quick ping just to confirm. Score: ${score}. Ping ${N}.`;
  } else {
    full = `${N}'s gait is steady at ${gaitPct}% off baseline - well within normal range. I think the environment and proximity signals are consistent with a normal night out. However I'm continuing to monitor in real time, and given it's ${DEMO.TIME_LABEL}, any shift in gait or sound would escalate this quickly. Score: ${score}. ${N} looks fine.`;
  }

  let oneliner = '';
  if (tier === 'emergency') {
    oneliner = `${gaitPct}% off + ${proxDist}m away - score ${score}. Go find them now.`;
  } else if (gaitHigh && soundSudden) {
    oneliner = `${gaitPct}% off and went quiet ${DEMO.STATIONARY_MIN} min ago - score ${score}. Check on them.`;
  } else if (gaitHigh) {
    oneliner = `Gait ${gaitPct}% off baseline at ${DEMO.TIME_LABEL} - score ${score}. Check on them.`;
  } else if (soundSudden) {
    oneliner = `Went suddenly quiet ${DEMO.STATIONARY_MIN} min ago - score ${score}. Reach out.`;
  } else if (gaitMid) {
    oneliner = `Gait ${gaitPct}% off - score ${score}. Monitoring closely.`;
  } else if (farFromGroup) {
    oneliner = `${proxDist}m from the group at ${DEMO.TIME_LABEL} - score ${score}. Worth a ping.`;
  } else if (tier === 'heads-up') {
    oneliner = `Mild signal flagged - score ${score}. Keeping an eye on ${N}.`;
  } else {
    oneliner = `All signals normal - score ${score}. ${N} looks good.`;
  }

  return { full, oneliner };
}

// ── Banner state (ported from updateBanner) ────────────────────────────
export function getBannerState(snapshot) {
  const { gaitPct, proxDist, soundShiftType } = snapshot;
  const gaitBad = gaitPct > 30;
  const proxBad = proxDist > 100;
  const soundBad = soundShiftType !== 'none';
  const count = [gaitBad, proxBad, soundBad].filter(Boolean).length;
  const tier = getSignalTier(snapshot);
  const dots = { gait: gaitBad, prox: proxBad, sound: soundBad };

  if (count === 0) {
    return { cls: 'ok', level: 'All Clear', levelColor: '#10b981', badge: 'Monitoring', badgeCls: 'clear', dots };
  }
  if (tier === 'emergency') {
    return { cls: 'emergency', level: 'Emergency', levelColor: '#ef4444', badge: 'Friends notified', badgeCls: 'notified', dots };
  }
  if (tier === 'urgent') {
    return { cls: 'danger', level: 'Urgent', levelColor: '#f97316', badge: 'Friends notified', badgeCls: 'notified', dots };
  }
  if (count >= 2) {
    return { cls: 'danger', level: 'Concern', levelColor: '#f97316', badge: 'Friends notified', badgeCls: 'notified', dots };
  }
  return { cls: 'warn', level: 'Heads Up', levelColor: '#f59e0b', badge: 'Watching', badgeCls: 'watching', dots };
}

// ── Per-signal readouts for the Signal Data panel (from renderRiskPanel) ──
export function getSignalReadouts({ gaitPct, proxDist, soundShiftType }) {
  return [
    {
      label: `Gait impairment (${gaitPct}%)`,
      color: gaitPct > 70 ? '#ef4444' : gaitPct > 50 ? '#f97316' : gaitPct > 30 ? '#f59e0b' : '#10b981',
      value: gaitPct > 70 ? 'High' : gaitPct > 50 ? 'Moderate' : gaitPct > 30 ? 'Mild' : 'Normal',
    },
    {
      label: `Distance from group (${proxDist}m)`,
      color: proxDist > 400 ? '#ef4444' : proxDist > 200 ? '#f97316' : proxDist > 100 ? '#f59e0b' : '#10b981',
      value: proxDist > 400 ? 'Separated' : proxDist > 200 ? 'Very far' : proxDist > 100 ? 'Far' : 'Close',
    },
    {
      label: `Sound shift (${soundShiftType})`,
      color: soundShiftType === 'sudden' ? '#ef4444' : soundShiftType === 'gradual' ? '#f59e0b' : '#10b981',
      value: soundShiftType === 'sudden' ? 'Flagged' : soundShiftType === 'gradual' ? 'Shifted' : 'Stable',
    },
    {
      label: `Stationary ${DEMO.STATIONARY_MIN} min`,
      color: DEMO.STATIONARY_MIN >= 60 ? '#ef4444' : DEMO.STATIONARY_MIN >= 30 ? '#f97316' : DEMO.STATIONARY_MIN >= 15 ? '#f59e0b' : '#10b981',
      value: DEMO.STATIONARY_MIN >= 60 ? '60+ min' : DEMO.STATIONARY_MIN >= 30 ? '30+ min' : DEMO.STATIONARY_MIN >= 15 ? '15+ min' : 'Active',
    },
    {
      label: `Battery ${DEMO.BATTERY_PCT}%`,
      color: DEMO.BATTERY_PCT < 20 ? '#ef4444' : '#10b981',
      value: DEMO.BATTERY_PCT < 20 ? 'Low' : 'OK',
    },
  ];
}

// ── Gait gauge helpers (from setGait) ──────────────────────────────────
export function getGaitColor(gaitPct) {
  return gaitPct <= 30 ? '#10b981' : gaitPct <= 50 ? '#84cc16' : gaitPct <= 70 ? '#f59e0b' : '#ef4444';
}

export function getGaitHero(gaitPct) {
  if (gaitPct <= 30) return { title: 'Looking good!', desc: 'Your walk is steady. No concerns detected.' };
  if (gaitPct <= 50) return { title: 'Mild irregularity detected.', desc: 'Minor deviation from your baseline. Being monitored.' };
  if (gaitPct <= 70) return { title: 'Mild irregularity detected.', desc: 'Your gait is noticeably off from your sober baseline.' };
  return { title: 'High concern.', desc: 'Significant gait impairment detected.' };
}

export function getShiftBox(envKey) {
  const shift = ENV_INFO[envKey].shift;
  if (shift === 'none') {
    return {
      cls: 'ok',
      strong: 'No shift detected.',
      rest: envKey === 'ride' ? 'In a ride, expected behavior.' : 'Still in a loud environment, consistent with your starting location.',
    };
  }
  if (shift === 'gradual') {
    return { cls: 'warn', strong: 'Gradual shift detected.', rest: 'Moved from a loud venue to a quieter outdoor environment.' };
  }
  return { cls: 'bad', strong: 'Sudden shift detected.', rest: 'Went from a clearly loud venue to completely quiet. This is flagged as suspicious.' };
}
