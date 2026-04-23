import { useWindowDimensions, type ViewStyle } from "react-native";
import { useSafeAreaInsets, type EdgeInsets } from "react-native-safe-area-context";

export const maxContentWidth = 560;

export type ScreenBottomSpacing = "stack" | "tab";

type ScreenLayoutOptions = {
  bottom?: ScreenBottomSpacing;
  centered?: boolean;
};

export function getHorizontalPadding(width: number): number {
  if (width <= 340) return 14;
  if (width <= 390) return 16;
  return 20;
}

export function getFloatingTabBarMetrics(insets: EdgeInsets, width: number) {
  const compact = width < 380;
  const bottom = Math.max(insets.bottom, 10);
  const side = compact ? 8 : 16;
  const height = (compact ? 62 : 70) + Math.max(insets.bottom, 6);

  return { bottom, compact, height, side };
}

export function getScreenTopPadding(insets: EdgeInsets, compact: boolean): number {
  return Math.max(insets.top + (compact ? 14 : 20), compact ? 30 : 38);
}

export function getScreenBottomPadding(insets: EdgeInsets, width: number, bottom: ScreenBottomSpacing): number {
  if (bottom === "tab") {
    const tabBar = getFloatingTabBarMetrics(insets, width);
    return tabBar.height + tabBar.bottom + 18;
  }

  return Math.max(insets.bottom, 12) + 28;
}

export function getResponsiveMediaHeight(
  width: number,
  options: { min: number; max: number; ratio: number },
): number {
  return Math.round(Math.min(options.max, Math.max(options.min, width * options.ratio)));
}

export function useScreenLayout(options: ScreenLayoutOptions = {}) {
  const insets = useSafeAreaInsets();
  const dimensions = useWindowDimensions();
  const compact = dimensions.width < 380 || dimensions.height < 700;
  const horizontalPadding = getHorizontalPadding(dimensions.width);
  const contentWidth = Math.max(
    0,
    Math.min(dimensions.width, maxContentWidth) - horizontalPadding * 2,
  );

  const contentStyle: ViewStyle = {
    width: "100%",
    maxWidth: maxContentWidth,
    alignSelf: "center",
    paddingHorizontal: horizontalPadding,
    paddingTop: getScreenTopPadding(insets, compact),
    paddingBottom: getScreenBottomPadding(insets, dimensions.width, options.bottom ?? "stack"),
    ...(options.centered ? { flexGrow: 1 } : null),
  };

  return {
    ...dimensions,
    compact,
    contentStyle,
    contentWidth,
    horizontalPadding,
    insets,
  };
}
