import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';

export default function BouncingDots() {
  const dots = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    dots.forEach(dot => dot.setValue(0));
    if (reduceMotion) return;
    const animation = Animated.parallel(dots.map((dot, index) => Animated.loop(Animated.sequence([
      Animated.delay(index * 120),
      Animated.timing(dot, { toValue: -5, duration: 180, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.timing(dot, { toValue: 0, duration: 180, easing: Easing.inOut(Easing.sin), useNativeDriver: true, isInteraction: false }),
      Animated.delay(600 - index * 120),
    ]))));
    animation.start();
    return () => { animation.stop(); dots.forEach(dot => dot.setValue(0)); };
  }, [dots, reduceMotion]);
  return <View style={styles.row} accessible accessibilityRole="progressbar" accessibilityLabel="Agent preparing response">
    {dots.map((dot, index) => <Animated.View key={index} style={[styles.dot, { transform: [{ translateY: dot }] }]} />)}
  </View>;
}
const styles = StyleSheet.create({
  row: { height: 24, flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#237A53' },
});
