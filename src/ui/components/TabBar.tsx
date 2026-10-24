/** Custom tab bar: Today / Path / Me, paper ground with a mist hairline (Home artboard). */
import type { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Txt } from '../Txt';
import { color, font, hit, layout } from '../theme';
import { Icon, type IconName } from './Icon';

/** derived from expo-router so @react-navigation/bottom-tabs needn't be a direct dependency */
export type TabBarProps = Parameters<NonNullable<ComponentProps<typeof Tabs>['tabBar']>>[0];

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Today', icon: 'sprout' },
  path: { label: 'Path', icon: 'path' },
  me: { label: 'Me', icon: 'me' },
};

export function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]} accessibilityRole="tablist">
      {state.routes.map((route, i) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === i;
        const onPress = () => {
          const ev = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !ev.defaultPrevented) navigation.navigate(route.name, route.params);
        };
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            style={styles.tab}
          >
            <Icon name={tab.icon} color={focused ? 'ink' : 'muted'} />
            <Txt variant="caption" color={focused ? 'ink' : 'muted'} style={{ fontFamily: focused ? font.bodySemi : font.bodyMedium }}>
              {tab.label}
            </Txt>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    paddingHorizontal: 40,
    minHeight: layout.tabBarHeight,
    backgroundColor: color.paper,
    borderTopWidth: 1,
    borderTopColor: color.mist,
  },
  tab: { minWidth: hit + 16, minHeight: hit, alignItems: 'center', justifyContent: 'center', gap: 4 },
});
