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
          size={60}
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
    marginTop: 10,
    marginBottom: 30,
    marginHorizontal: 40
  }
});

export default RecordingControl;
