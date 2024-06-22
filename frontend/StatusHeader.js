// components/StatusHeader.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

const StatusHeader = ({ status, isConnected, startConnections }) => {
  const connectionStatusColor = isConnected ? "green" : "red";

  return (
    <View style={styles.header}>
      <Text style={styles.title}>STATUS</Text>
      <View
        style={[
          styles.connectionIndicator,
          { backgroundColor: connectionStatusColor }
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30
  },
  title: {
    fontSize: 45,
    color: "#ffffff",
    marginRight: 10
  },
  connectionIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 10
  },
  refreshButton: {
    marginLeft: 10,
    padding: 10
  }
});

export default StatusHeader;
