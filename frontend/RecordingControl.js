// components/RecordingControl.js
import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

const RecordingControl = ({ toggleRecording, recording }) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={toggleRecording}>
        <FontAwesome
          name="microphone"
          size={80}
          color={recording ? "red" : "white"}
          style={styles.microphoneIcon}
        />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "space-around"
  },
  microphoneIcon: {
    marginTop: 60,
    marginBottom: 30
  }
});

export default RecordingControl;
