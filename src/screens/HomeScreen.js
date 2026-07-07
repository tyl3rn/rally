import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { FRIENDS } from '../logic/safety';

// Placeholder hub while the map (index.html) is ported. Screens marked
// "Soon" exist in the HTML demo but not yet in the native app.
const NAV_ITEMS = [
  { key: 'alerts', title: 'Safety Alerts', desc: 'Live signal monitoring + AI analysis', route: 'Alerts' },
  { key: 'map', title: 'Rally Map', desc: 'Live map of your group', route: null },
  { key: 'friends', title: 'Friends', desc: 'Manage your rally', route: null },
  { key: 'profile', title: 'Profile', desc: 'Settings and safe locations', route: null },
];

export default function HomeScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={s.screen}
      contentContainerStyle={[s.content, { paddingTop: insets.top + 28 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.logo}>Rally</Text>
      <Text style={s.tagline}>Look out for each other, automatically.</Text>

      <View style={s.statusCard}>
        <View style={s.statusDot} />
        <View style={{ flex: 1 }}>
          <Text style={s.statusTitle}>Rally active</Text>
          <Text style={s.statusDesc}>{FRIENDS.length + 1} members · all signals monitored</Text>
        </View>
      </View>

      <View style={{ gap: 10 }}>
        {NAV_ITEMS.map((item) => (
          <Pressable
            key={item.key}
            disabled={!item.route}
            onPress={() => item.route && navigation.navigate(item.route)}
            style={({ pressed }) => [s.navCard, !item.route && { opacity: 0.45 }, pressed && { opacity: 0.7 }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={s.navTitle}>{item.title}</Text>
              <Text style={s.navDesc}>{item.desc}</Text>
            </View>
            {item.route ? (
              <Text style={s.navChevron}>›</Text>
            ) : (
              <View style={s.soonPill}>
                <Text style={s.soonText}>Soon</Text>
              </View>
            )}
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, paddingBottom: 40 },
  logo: { fontSize: 34, fontWeight: '800', color: colors.text, letterSpacing: -1 },
  tagline: { fontSize: 13, color: colors.textMuted, marginTop: 4, marginBottom: 22 },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: 'rgba(53,94,59,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(53,94,59,0.35)',
    borderRadius: 14,
    padding: 14,
    marginBottom: 22,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.safe },
  statusTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  statusDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  navCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 16,
  },
  navTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  navDesc: { fontSize: 12, color: colors.textMuted, marginTop: 3 },
  navChevron: { fontSize: 24, color: colors.textMuted },
  soonPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  soonText: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
});
