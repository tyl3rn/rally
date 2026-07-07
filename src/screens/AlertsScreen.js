import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import Svg, { Circle, Line, Path, Polygon, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import {
  DEMO,
  ENV_INFO,
  FRIENDS,
  computeNarrativeScore,
  getAiContent,
  getBannerState,
  getGaitColor,
  getGaitHero,
  getShiftBox,
  getSignalReadouts,
  getSignalTier,
} from '../logic/safety';

const LOG_KEY = 'rally_notif_log';
const GAUGE_R = 65;
const GAUGE_CIRC = 2 * Math.PI * GAUGE_R;

const BANNER_STYLES = {
  ok: { backgroundColor: 'rgba(53,94,59,0.1)', borderColor: 'rgba(53,94,59,0.35)' },
  warn: { backgroundColor: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.4)' },
  danger: { backgroundColor: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.4)' },
  emergency: { backgroundColor: 'rgba(220,38,38,0.15)', borderColor: 'rgba(220,38,38,0.6)' },
};

const BADGE_STYLES = {
  notified: { backgroundColor: 'rgba(239,68,68,0.18)', color: '#fca5a5', borderColor: 'rgba(239,68,68,0.3)' },
  watching: { backgroundColor: 'rgba(245,158,11,0.15)', color: '#fbbf24', borderColor: 'rgba(245,158,11,0.25)' },
  clear: { backgroundColor: 'rgba(53,94,59,0.15)', color: '#6fcf7c', borderColor: 'rgba(53,94,59,0.25)' },
};

const AI_BOX_STYLES = {
  ok: { backgroundColor: 'rgba(53,94,59,0.08)', borderColor: 'rgba(53,94,59,0.3)', color: '#6fcf7c' },
  tier1: { backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)', color: '#fbbf24' },
  tier2: { backgroundColor: 'rgba(249,115,22,0.11)', borderColor: 'rgba(249,115,22,0.45)', color: '#f97316' },
  tier3: { backgroundColor: 'rgba(220,38,38,0.14)', borderColor: 'rgba(220,38,38,0.65)', color: '#ef4444' },
};

const SHIFT_BOX_STYLES = {
  ok: { backgroundColor: 'rgba(53,94,59,0.1)', borderColor: 'rgba(53,94,59,0.3)', color: '#6fcf7c' },
  warn: { backgroundColor: 'rgba(245,158,11,0.08)', borderColor: 'rgba(245,158,11,0.3)', color: '#fbbf24' },
  bad: { backgroundColor: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171' },
};

const LOG_TIER_STYLES = {
  tier1: { backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  tier2: { backgroundColor: 'rgba(249,115,22,0.18)', color: '#f97316' },
  tier3: { backgroundColor: 'rgba(220,38,38,0.2)', color: '#ef4444' },
};

const WAVE_HEIGHTS = [8, 14, 22, 32, 18, 36, 24, 16, 30, 20, 28, 12, 38, 22, 16, 10];

const TABS = [
  { id: 'gait', label: 'Gait' },
  { id: 'prox', label: 'Proximity' },
  { id: 'sound', label: 'Sound' },
  { id: 'log', label: 'Log' },
];

function tierToBoxCls(tier) {
  return tier === 'emergency' ? 'tier3' : tier === 'urgent' ? 'tier2' : tier === 'heads-up' ? 'tier1' : 'ok';
}

// ── Small building blocks ───────────────────────────────────────────────

function Card({ style, children }) {
  return <View style={[s.card, style]}>{children}</View>;
}

function EnvIcon({ kind }) {
  const common = { stroke: 'white', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      {kind === 'bar' && (
        <>
          <Path d="M8 22h8" {...common} />
          <Path d="M12 11v11" {...common} />
          <Path d="M20 2H4l6 9h4l6-9z" {...common} />
        </>
      )}
      {kind === 'outside' && <Path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" {...common} />}
      {kind === 'quiet' && (
        <>
          <Polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" {...common} />
          <Line x1={23} y1={9} x2={17} y2={15} {...common} />
          <Line x1={17} y1={9} x2={23} y2={15} {...common} />
        </>
      )}
      {kind === 'ride' && (
        <>
          <Rect x={1} y={3} width={15} height={13} rx={2} {...common} />
          <Path d="M16 8h4l3 5v3h-7V8z" {...common} />
          <Circle cx={5.5} cy={18.5} r={2.5} {...common} />
          <Circle cx={18.5} cy={18.5} r={2.5} {...common} />
        </>
      )}
    </Svg>
  );
}

function WaveBar({ height }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const duration = Math.round((0.35 + Math.random() * 0.55) * 1000);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.View
      style={{
        width: 4,
        borderRadius: 2,
        height,
        backgroundColor: colors.primary,
        opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
        transform: [{ scaleY: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }],
      }}
    />
  );
}

function GaitGauge({ gaitPct }) {
  const col = getGaitColor(gaitPct);
  return (
    <View style={s.gaugeWrap}>
      <Svg width={148} height={148} viewBox="0 0 160 160">
        <Circle cx={80} cy={80} r={GAUGE_R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={12} />
        <Circle
          cx={80}
          cy={80}
          r={GAUGE_R}
          fill="none"
          stroke={col}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${GAUGE_CIRC}`}
          strokeDashoffset={GAUGE_CIRC - (gaitPct / 100) * GAUGE_CIRC}
          rotation={-90}
          origin="80, 80"
        />
      </Svg>
      <View style={s.gaugeCenter}>
        <Text style={[s.gaugeNum, { color: col }]}>{gaitPct}%</Text>
        <Text style={s.gaugeLbl}>impairment</Text>
      </View>
    </View>
  );
}

function AiBox({ snapshot }) {
  const tier = getSignalTier(snapshot);
  const box = AI_BOX_STYLES[tierToBoxCls(tier)];
  const { full } = getAiContent(snapshot);
  return (
    <View style={[s.aiBox, { backgroundColor: box.backgroundColor, borderColor: box.borderColor }]}>
      <Text style={[s.aiBoxLabel, { color: box.color }]}>AI ANALYSIS</Text>
      <Text style={[s.aiBoxText, { color: box.color }]}>{full}</Text>
    </View>
  );
}

function RiskPanel({ snapshot }) {
  const rows = getSignalReadouts(snapshot);
  return (
    <View style={s.riskPanel}>
      <Text style={s.riskPanelTitle}>SIGNAL DATA</Text>
      {rows.map((r, i) => (
        <View key={r.label} style={[s.sigDataRow, i === rows.length - 1 && { borderBottomWidth: 0 }]}>
          <Text style={s.sigDataLabel}>{r.label}</Text>
          <View style={s.sigDataVal}>
            <View style={[s.sigBox, { backgroundColor: r.color }]} />
            <Text style={[s.sigDataText, { color: r.color }]}>{r.value}</Text>
          </View>
        </View>
      ))}
      <AiBox snapshot={snapshot} />
    </View>
  );
}

// ── Screen ──────────────────────────────────────────────────────────────

export default function AlertsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState('gait');
  const [gaitPct, setGaitPct] = useState(12);
  const [proxDist, setProxDist] = useState(45);
  const [envKey, setEnvKey] = useState('bar');
  const [demoActive, setDemoActive] = useState(false);
  const [log, setLog] = useState([]);
  const lastLoggedTier = useRef(null);

  const soundShiftType = ENV_INFO[envKey].shift;
  const snapshot = useMemo(
    () => ({ gaitPct, proxDist, soundShiftType }),
    [gaitPct, proxDist, soundShiftType],
  );

  const banner = getBannerState(snapshot);
  const hero = getGaitHero(gaitPct);
  const shiftBox = getShiftBox(envKey);

  // Load persisted notification log once (localStorage → AsyncStorage)
  useEffect(() => {
    AsyncStorage.getItem(LOG_KEY)
      .then((v) => v && setLog(JSON.parse(v)))
      .catch(() => {});
  }, []);

  // Log once per tier change, exactly like maybeLogNotification/resetLogTier
  useEffect(() => {
    const tier = getSignalTier(snapshot);
    if (!tier) {
      lastLoggedTier.current = null;
      return;
    }
    if (tier === lastLoggedTier.current) return;
    lastLoggedTier.current = tier;
    const { oneliner } = getAiContent(snapshot);
    const entry = { time: new Date().toISOString(), tier, logSummary: oneliner, ...snapshot };
    setLog((prev) => {
      const next = [entry, ...prev].slice(0, 100);
      AsyncStorage.setItem(LOG_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, [snapshot]);

  const clearLog = () => {
    setLog([]);
    lastLoggedTier.current = null;
    AsyncStorage.removeItem(LOG_KEY).catch(() => {});
  };

  const toggleDemo = () => {
    const next = !demoActive;
    setDemoActive(next);
    if (next) {
      setGaitPct(59);
      setActiveTab('gait');
    }
  };

  const badge = BADGE_STYLES[banner.badgeCls];

  return (
    <View style={s.screen}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <Text style={s.back}>‹ Back</Text>
        </Pressable>
        <Text style={s.headerTitle}>Safety Alerts</Text>
        <View style={s.headerRight}>
          <Pressable
            onPress={toggleDemo}
            style={[s.pill, demoActive ? s.pillDemoOn : s.pillDemoOff]}
          >
            <Text style={[s.pillText, { color: demoActive ? '#6fcf7c' : colors.textMuted }]}>Demo</Text>
          </Pressable>
          <View style={[s.pill, s.pillLive]}>
            <Text style={[s.pillText, { color: colors.safe }]}>LIVE</Text>
          </View>
        </View>
      </View>

      {/* Alert banner */}
      <View style={[s.banner, BANNER_STYLES[banner.cls]]}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={s.bannerTopRow}>
            <Text style={[s.alertLevel, { color: banner.levelColor }]}>{banner.level}</Text>
            <View style={[s.notifBadge, { backgroundColor: badge.backgroundColor, borderColor: badge.borderColor }]}>
              <Text style={[s.notifBadgeText, { color: badge.color }]}>{banner.badge}</Text>
            </View>
          </View>
          <Text style={s.oneliner}>{getAiContent(snapshot).oneliner}</Text>
        </View>
        <View style={s.signalDots}>
          {[
            ['Gait', banner.dots.gait],
            ['Proximity', banner.dots.prox],
            ['Sound', banner.dots.sound],
          ].map(([lbl, bad]) => (
            <View key={lbl} style={s.sigRow}>
              <Text style={s.sigLbl}>{lbl}</Text>
              <View style={[s.sigDot, { backgroundColor: bad ? colors.danger : colors.primary }]} />
            </View>
          ))}
        </View>
      </View>

      {/* Tab bar */}
      <View style={s.tabBar}>
        {TABS.map((t) => (
          <Pressable key={t.id} style={[s.tab, activeTab === t.id && s.tabActive]} onPress={() => setActiveTab(t.id)}>
            <Text style={[s.tabText, activeTab === t.id && { color: '#6fcf7c' }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* TAB 1: Gait */}
        {activeTab === 'gait' && (
          <>
            <Card style={{ alignItems: 'center' }}>
              <GaitGauge gaitPct={gaitPct} />
              <Text style={s.heroTitle}>{hero.title}</Text>
              <Text style={s.heroDesc}>{hero.desc}</Text>
            </Card>

            {!demoActive && (
              <Card>
                <View style={s.sliderRow}>
                  <Text style={s.sliderLabel}>Simulate gait impairment</Text>
                  <Text style={s.sliderValue}>{gaitPct}%</Text>
                </View>
                <Slider
                  minimumValue={0}
                  maximumValue={99}
                  step={1}
                  value={gaitPct}
                  onValueChange={(v) => setGaitPct(Math.round(v))}
                  minimumTrackTintColor={colors.primary}
                  maximumTrackTintColor="rgba(255,255,255,0.1)"
                  thumbTintColor={colors.primary}
                />
              </Card>
            )}

            <RiskPanel snapshot={snapshot} />
          </>
        )}

        {/* TAB 2: Proximity */}
        {activeTab === 'prox' && (
          <>
            <Card>
              <Text style={s.sectionLbl}>RALLY MEMBERS</Text>
              <View style={{ gap: 7 }}>
                <View
                  style={[
                    s.distRow,
                    { borderColor: 'rgba(124,58,237,0.4)', backgroundColor: 'rgba(124,58,237,0.06)' },
                    proxDist > 150 && { borderColor: 'rgba(239,68,68,0.5)', backgroundColor: 'rgba(239,68,68,0.09)' },
                  ]}
                >
                  <View style={[s.distAv, { backgroundColor: colors.accent }]}>
                    <Text style={s.distAvText}>You</Text>
                  </View>
                  <Text style={s.distName}>You</Text>
                  <Text
                    style={[
                      s.distVal,
                      { color: proxDist > 200 ? '#ef4444' : proxDist > 100 ? '#f59e0b' : '#10b981' },
                    ]}
                  >
                    {proxDist}m away
                  </Text>
                </View>
                {FRIENDS.map((f) => (
                  <View
                    key={f.name}
                    style={[
                      s.distRow,
                      f.dist > 150 && { borderColor: 'rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.06)' },
                    ]}
                  >
                    <View style={[s.distAv, { backgroundColor: f.color }]}>
                      <Text style={s.distAvText}>{f.ini}</Text>
                    </View>
                    <Text style={s.distName}>{f.name}</Text>
                    <Text style={[s.distVal, { color: f.dist > 200 ? '#ef4444' : f.dist > 100 ? '#f59e0b' : '#6fcf7c' }]}>
                      {f.dist}m away
                    </Text>
                  </View>
                ))}
              </View>
            </Card>

            <Card>
              <View style={s.sliderRow}>
                <Text style={s.sliderLabel}>Simulate your distance from group</Text>
                <Text style={s.sliderValue}>{proxDist}m</Text>
              </View>
              <Slider
                minimumValue={0}
                maximumValue={500}
                step={1}
                value={proxDist}
                onValueChange={(v) => setProxDist(Math.round(v))}
                minimumTrackTintColor={colors.primary}
                maximumTrackTintColor="rgba(255,255,255,0.1)"
                thumbTintColor={colors.primary}
              />
            </Card>

            <RiskPanel snapshot={snapshot} />
          </>
        )}

        {/* TAB 3: Sound */}
        {activeTab === 'sound' && (
          <>
            <Card>
              <Text style={s.soundTitle}>AI Ambient Detection</Text>
              <Text style={s.soundDesc}>
                Rally analyzes background noise to detect sudden environment shifts that may indicate danger.
              </Text>
              <View style={s.wave}>
                {WAVE_HEIGHTS.map((h, i) => (
                  <WaveBar key={i} height={h} />
                ))}
              </View>
              <Text style={s.detectedLine}>
                Detected: <Text style={{ color: colors.text, fontWeight: '700' }}>{ENV_INFO[envKey].label}</Text>
              </Text>
              <Text style={s.simNote}>Simulating ambient audio detection for this demo. Tap to change environment.</Text>
              <View style={s.envGrid}>
                {[
                  ['bar', 'Bar / Venue'],
                  ['outside', 'Outside / Street'],
                  ['quiet', 'Quiet / Alone'],
                  ['ride', 'In a Car'],
                ].map(([key, lbl]) => {
                  const active = envKey === key;
                  const flagged = active && ENV_INFO[key].shift !== 'none';
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setEnvKey(key)}
                      style={[
                        s.envItem,
                        active && { borderColor: colors.primary, backgroundColor: 'rgba(53,94,59,0.12)' },
                        flagged && { borderColor: colors.danger, backgroundColor: 'rgba(239,68,68,0.1)' },
                      ]}
                    >
                      <View style={{ opacity: active ? 1 : 0.7, marginBottom: 4 }}>
                        <EnvIcon kind={key} />
                      </View>
                      <Text
                        style={[
                          s.envLbl,
                          active && { color: '#6fcf7c', fontWeight: '600' },
                          flagged && { color: colors.danger },
                        ]}
                      >
                        {lbl}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <View
                style={[
                  s.shiftBox,
                  {
                    backgroundColor: SHIFT_BOX_STYLES[shiftBox.cls].backgroundColor,
                    borderColor: SHIFT_BOX_STYLES[shiftBox.cls].borderColor,
                  },
                ]}
              >
                <Text style={[s.shiftBoxText, { color: SHIFT_BOX_STYLES[shiftBox.cls].color }]}>
                  <Text style={{ fontWeight: '800' }}>{shiftBox.strong}</Text> {shiftBox.rest}
                </Text>
              </View>
            </Card>

            <RiskPanel snapshot={snapshot} />
          </>
        )}

        {/* TAB 4: Notification log */}
        {activeTab === 'log' && (
          <Card>
            <View style={s.logHeaderRow}>
              <Text style={s.sectionLbl}>NOTIFICATIONS SENT</Text>
              <Pressable onPress={clearLog} style={s.logClear}>
                <Text style={{ fontSize: 11, color: colors.textMuted }}>Clear</Text>
              </Pressable>
            </View>
            {log.length === 0 ? (
              <Text style={s.logEmpty}>No notifications sent yet during this session.</Text>
            ) : (
              <View style={{ gap: 8 }}>
                {log.map((e, i) => {
                  const d = new Date(e.time);
                  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const dateStr = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                  const tierCls = e.tier === 'emergency' ? 'tier3' : e.tier === 'urgent' ? 'tier2' : 'tier1';
                  const tierTxt = e.tier === 'emergency' ? 'EMERGENCY' : e.tier === 'urgent' ? 'URGENT' : 'HEADS UP';
                  const chips = [
                    [`Gait ${e.gaitPct}%`, e.gaitPct > 30],
                    [`Dist ${e.proxDist}m`, e.proxDist > 100],
                    [`Sound: ${e.soundShiftType}`, e.soundShiftType !== 'none'],
                  ];
                  return (
                    <View key={e.time + i} style={s.logEntry}>
                      <View style={s.logEntryTop}>
                        <View style={[s.logEntryTier, { backgroundColor: LOG_TIER_STYLES[tierCls].backgroundColor }]}>
                          <Text style={[s.logEntryTierText, { color: LOG_TIER_STYLES[tierCls].color }]}>{tierTxt}</Text>
                        </View>
                        <Text style={s.logEntryTime}>
                          {timeStr}
                          {'\n'}
                          {dateStr}
                        </Text>
                      </View>
                      <View style={s.logEntrySignals}>
                        {chips.map(([txt, active]) => (
                          <View key={txt} style={[s.logChip, active && s.logChipActive]}>
                            <Text style={[s.logChipText, active && { color: '#fca5a5' }]}>{txt}</Text>
                          </View>
                        ))}
                      </View>
                      {!!e.logSummary && <Text style={s.logBlurb}>{e.logSummary}</Text>}
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: 'rgba(8,8,16,0.95)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { fontSize: 14, color: colors.textMuted },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 50, borderWidth: 1 },
  pillDemoOff: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: colors.border },
  pillDemoOn: { backgroundColor: 'rgba(53,94,59,0.2)', borderColor: 'rgba(53,94,59,0.5)' },
  pillLive: { backgroundColor: 'rgba(16,185,129,0.12)', borderColor: 'transparent' },
  pillText: { fontSize: 11, fontWeight: '600' },

  banner: {
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bannerTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  alertLevel: { fontSize: 16, fontWeight: '800' },
  notifBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  notifBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },
  oneliner: { fontSize: 11, color: colors.textMuted, lineHeight: 15, fontStyle: 'italic' },
  signalDots: { gap: 5, alignItems: 'flex-end' },
  sigRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  sigDot: { width: 9, height: 9, borderRadius: 5 },
  sigLbl: { fontSize: 10, color: colors.textMuted },

  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    marginTop: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: { flex: 1, paddingTop: 11, paddingBottom: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: colors.primary },
  tabText: { fontSize: 12, fontWeight: '600', color: colors.textMuted },

  content: { padding: 14, paddingBottom: 32, gap: 14 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 16 },

  gaugeWrap: { width: 148, height: 148, marginBottom: 14 },
  gaugeCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', gap: 2 },
  gaugeNum: { fontSize: 34, fontWeight: '800', letterSpacing: -1 },
  gaugeLbl: { fontSize: 11, color: colors.textMuted },
  heroTitle: { fontSize: 15, fontWeight: '700', color: colors.text, textAlign: 'center' },
  heroDesc: { fontSize: 12, color: colors.textMuted, textAlign: 'center', marginTop: 4, lineHeight: 18 },

  sliderRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  sliderLabel: { fontSize: 12, color: colors.textMuted },
  sliderValue: { fontSize: 12, color: colors.text, fontWeight: '700' },

  sectionLbl: { fontSize: 10, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginBottom: 10 },
  distRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  distAv: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  distAvText: { fontSize: 10, fontWeight: '700', color: 'white' },
  distName: { fontSize: 13, fontWeight: '600', color: colors.text, flex: 1 },
  distVal: { fontSize: 12, fontWeight: '700' },

  soundTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  soundDesc: { fontSize: 12, color: colors.textMuted, marginTop: 3, lineHeight: 18 },
  wave: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, height: 36, marginVertical: 10 },
  detectedLine: { textAlign: 'center', fontSize: 13, color: colors.textMuted, marginBottom: 14 },
  simNote: { fontSize: 11, color: colors.textMuted, fontStyle: 'italic', marginBottom: 10 },
  envGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  envItem: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 11,
    padding: 10,
    alignItems: 'center',
  },
  envLbl: { fontSize: 11, color: colors.textMuted },
  shiftBox: { borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, marginTop: 10 },
  shiftBoxText: { fontSize: 12, lineHeight: 18 },

  riskPanel: { borderRadius: 16, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 16, paddingVertical: 15 },
  riskPanelTitle: { fontSize: 11, fontWeight: '700', color: colors.textMuted, letterSpacing: 1, marginBottom: 8 },
  sigDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  sigDataLabel: { fontSize: 11, color: colors.textMuted },
  sigDataVal: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sigBox: { width: 9, height: 9, borderRadius: 2 },
  sigDataText: { fontSize: 11, fontWeight: '600' },
  aiBox: { marginTop: 12, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 11 },
  aiBoxLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, opacity: 0.7, marginBottom: 6 },
  aiBoxText: { fontSize: 12, lineHeight: 19 },

  logHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  logClear: { paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: colors.border, borderRadius: 20 },
  logEmpty: { textAlign: 'center', color: colors.textMuted, fontSize: 12, paddingVertical: 28 },
  logEntry: { backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: colors.border, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 12 },
  logEntryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  logEntryTier: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 20 },
  logEntryTierText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6 },
  logEntryTime: { fontSize: 10, color: colors.textMuted, textAlign: 'right', lineHeight: 14 },
  logEntrySignals: { flexDirection: 'row', gap: 5, flexWrap: 'wrap', marginTop: 7 },
  logChip: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.06)' },
  logChipActive: { backgroundColor: 'rgba(239,68,68,0.12)' },
  logChipText: { fontSize: 10, color: colors.textMuted },
  logBlurb: { fontSize: 11, color: colors.textMuted, marginTop: 6, lineHeight: 15 },
});
