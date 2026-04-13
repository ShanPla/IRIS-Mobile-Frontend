import { StyleSheet, View } from "react-native";

export default function ReferenceBackdrop() {
  return (
    <View pointerEvents="none" style={styles.fill}>
      <View style={[styles.blob, styles.topBlob]} />
      <View style={[styles.blob, styles.bottomBlob]} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  blob: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
  },
  topBlob: {
    top: -110,
    right: -80,
    backgroundColor: "rgba(37,99,235,0.08)",
  },
  bottomBlob: {
    bottom: -140,
    left: -70,
    backgroundColor: "rgba(100,116,139,0.08)",
  },
});
